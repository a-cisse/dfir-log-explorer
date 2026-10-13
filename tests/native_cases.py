"""Exercise MVP 1 Linux native dialogs and persistence using synthetic fixtures.

Run inside an Xvfb/DBus session with tauri-driver listening on port 4444:
    python3 tests/native_cases.py /absolute/path/to/dfir-log-explorer
"""
import base64
import ctypes as c
import json
import pathlib
import sys
import tempfile
import time
from native_smoke import command, wait_for

x = c.CDLL("libX11.so.6")
test = c.CDLL("libXtst.so.6")
x.XOpenDisplay.argtypes = [c.c_char_p]
x.XOpenDisplay.restype = c.c_void_p
x.XStringToKeysym.argtypes = [c.c_char_p]
x.XStringToKeysym.restype = c.c_ulong
x.XKeysymToKeycode.argtypes = [c.c_void_p, c.c_ulong]
x.XKeysymToKeycode.restype = c.c_uint
x.XKeycodeToKeysym.argtypes = [c.c_void_p, c.c_uint, c.c_int]
x.XKeycodeToKeysym.restype = c.c_ulong
x.XFlush.argtypes = [c.c_void_p]
test.XTestFakeKeyEvent.argtypes = [c.c_void_p, c.c_uint, c.c_int, c.c_ulong]
display = x.XOpenDisplay(None)
assert display, "X display required for native dialogs"

x.XDefaultRootWindow.argtypes = [c.c_void_p]
x.XDefaultRootWindow.restype = c.c_ulong
x.XQueryTree.argtypes = [c.c_void_p, c.c_ulong, c.POINTER(c.c_ulong), c.POINTER(c.c_ulong), c.POINTER(c.POINTER(c.c_ulong)), c.POINTER(c.c_uint)]
x.XFetchName.argtypes = [c.c_void_p, c.c_ulong, c.POINTER(c.c_char_p)]
x.XFree.argtypes = [c.c_void_p]
x.XSetInputFocus.argtypes = [c.c_void_p, c.c_ulong, c.c_int, c.c_ulong]
x.XRaiseWindow.argtypes = [c.c_void_p, c.c_ulong]


class WindowAttributes(c.Structure):
    _fields_ = [
        ("x", c.c_int), ("y", c.c_int), ("width", c.c_int), ("height", c.c_int),
        ("border_width", c.c_int), ("depth", c.c_int), ("visual", c.c_void_p),
        ("root", c.c_ulong), ("window_class", c.c_int), ("bit_gravity", c.c_int),
        ("win_gravity", c.c_int), ("backing_store", c.c_int),
        ("backing_planes", c.c_ulong), ("backing_pixel", c.c_ulong),
        ("save_under", c.c_int), ("colormap", c.c_ulong),
        ("map_installed", c.c_int), ("map_state", c.c_int),
        ("all_event_masks", c.c_long), ("your_event_mask", c.c_long),
        ("do_not_propagate_mask", c.c_long), ("override_redirect", c.c_int),
        ("screen", c.c_void_p),
    ]


x.XGetWindowAttributes.argtypes = [c.c_void_p, c.c_ulong, c.POINTER(WindowAttributes)]


def dialogs(window=None):
    window = window or x.XDefaultRootWindow(display)
    result = []
    name = c.c_char_p()
    if x.XFetchName(display, window, c.byref(name)) and name.value:
        title = name.value.decode(errors="replace")
        x.XFree(name)
        attributes = WindowAttributes()
        visible = x.XGetWindowAttributes(display, window, c.byref(attributes)) and attributes.map_state == 2
        if visible and any(word in title.lower() for word in ("open", "save", "select")):
            result.append((window, title))
    root, parent = c.c_ulong(), c.c_ulong()
    children, count = c.POINTER(c.c_ulong)(), c.c_uint()
    if x.XQueryTree(display, window, c.byref(root), c.byref(parent), c.byref(children), c.byref(count)):
        ids = [children[i] for i in range(count.value)]
        if children:
            x.XFree(children)
        for child in ids:
            result.extend(dialogs(child))
    return result


def key(name, pressed):
    symbol = x.XStringToKeysym(name.encode())
    code = x.XKeysymToKeycode(display, symbol)
    assert code, name
    test.XTestFakeKeyEvent(display, code, int(pressed), 0)
    x.XFlush(display)


def tap(name):
    key(name, True)
    key(name, False)


def location(path):
    window, title = wait_for(lambda: dialogs() and dialogs()[-1])
    x.XRaiseWindow(display, window)
    x.XSetInputFocus(display, window, 1, 0)
    x.XFlush(display)
    time.sleep(.5)
    key("Control_L", True)
    tap("l")
    key("Control_L", False)
    time.sleep(.2)
    key("Control_L", True)
    tap("a")
    key("Control_L", False)
    for char in str(path):
        symbol = ord(char)
        code = x.XKeysymToKeycode(display, symbol)
        assert code, char
        shift = x.XKeycodeToKeysym(display, code, 0) != symbol
        if shift:
            key("Shift_L", True)
        test.XTestFakeKeyEvent(display, code, 1, 0)
        test.XTestFakeKeyEvent(display, code, 0, 0)
        if shift:
            key("Shift_L", False)
        x.XFlush(display)
        time.sleep(.005)
    tap("Return")
    time.sleep(.8)
    tap("Return")


def main():
    binary = str(pathlib.Path(sys.argv[1]).resolve())
    fixtures = pathlib.Path(__file__).resolve().parent / "fixtures"
    with tempfile.TemporaryDirectory(prefix="dfir-native-cases-") as directory:
        path = pathlib.Path(directory) / "incident.dfir"
        result = command("POST", "/session", {"capabilities": {"alwaysMatch": {"tauri:options": {"application": binary}}}})
        root = "/session/" + result["sessionId"]

        def script(code):
            return command("POST", root + "/execute/sync", {"script": code, "args": []})

        def invoke(name, payload=None):
            return command("POST", root + "/execute/async", {
                "script": "const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke(" + json.dumps(name) + ", " + json.dumps(payload or {}) + ").then(done).catch(e => done({error:String(e)}));", "args": [],
            })

        def click(selector):
            script("document.querySelector(" + json.dumps(selector) + ").click();")

        def summary():
            result = invoke("case_summary")
            return result if "error" not in result else None

        def query(**criteria):
            return invoke("query_events", {"query": {"search": "", "onlyWarnings": False, "offset": 0, "limit": 500, **criteria}})

        def select(selector, value):
            script("const element = document.querySelector(" + json.dumps(selector) + "); element.value = " + json.dumps(value) + "; element.dispatchEvent(new Event('change', {bubbles:true}));")

        try:
            wait_for(lambda: script("return !!document.querySelector('.case-bar')"))
            assert not script("return !!document.querySelector('.preview-banner')")
            click(".sample-button")
            wait_for(lambda: summary() and len(summary()["sources"]) == 1)
            assert query()["total"] == 13
            wait_for(lambda: script("return document.querySelectorAll('.table-row').length > 0"))
            assert not script("return !!document.querySelector('.parsing-summary, .timeline-card, .additional-filters')")
            assert script("return document.querySelector('.table-row').getBoundingClientRect().top") <= 220
            click(".case-toggle")
            click("[data-case-action=save]")
            location(path)
            wait_for(lambda: summary() and summary()["path"] == str(path))
            assert path.exists()
            assert summary()["sources"][0]["provenance"] == "Bundled synthetic fixture"
            # Import through the production file picker and UI Channel handler.
            for mode, fixture, expected in [("nginx", "nginx-access.log", 17), ("json_lines", "events.jsonl", 23)]:
                select("[aria-label='Parser format']", mode)
                click(".import-actions .primary-button")
                location(fixtures / fixture)
                wait_for(lambda: query().get("total") == expected)
            sources = summary()["sources"]
            assert [source["parserMode"] for source in sources] == ["auto", "nginx", "json_lines"]
            assert query(sourceId=2)["total"] == 4
            assert query(parser="nginx")["total"] == 3
            assert query(jsonFilter={"key": "user", "value": "alice"})["total"] == 2
            assert query(timeFrom=1791878400000, timeTo=1791878401000)["total"] == 2
            detail = invoke("event_detail", {"id": 18})
            assert detail["sourceId"] == 3
            assert detail["lineNumber"] == 1
            assert detail["jsonFields"]["context"]["synthetic"] is True
            click(".case-toggle")
            click("[data-case-action=new]")
            wait_for(lambda: summary() and len(summary()["sources"]) == 0)
            assert path.exists()
            click(".case-toggle")
            click("[data-case-action=open]")
            location(path)
            wait_for(lambda: summary() and len(summary()["sources"]) == 3)
            assert query()["total"] == 23
            assert summary()["sources"] == sources
            wait_for(lambda: script("return [...document.querySelectorAll('[role=columnheader]')].some(element => element.textContent.includes('Source'))"))
            # Selected source provenance and combined filters through native UI.
            select("[aria-label='Source filter']", "3")
            click("[aria-label='Additional filters']")
            select("[aria-label='Timestamp presence']", "false")
            wait_for(lambda: script("return document.querySelector('.table-footer')?.textContent.includes('1–3 of 3 events')"))
            click(".table-row")
            wait_for(lambda: script("return !!document.querySelector('.event-provenance')"))
            assert "events.jsonl" in script("return document.querySelector('.event-provenance').textContent")
            screenshot = command("GET", root + "/screenshot")
            pathlib.Path("/tmp/dfir-mvp1-native.png").write_bytes(base64.b64decode(screenshot))
            assert len(invoke("close_case")["sources"]) == 0
            print("Native MVP 1 passed: save/open dialogs, two real file imports, atomic source metadata, persistent reopening, cross-source UTC/JSON filters and correct inspector provenance.")
        except Exception:
            try:
                screenshot = command("GET", root + "/screenshot")
                pathlib.Path("/tmp/dfir-mvp1-native-failure.png").write_bytes(base64.b64decode(screenshot))
            except Exception:
                pass
            raise
        finally:
            command("DELETE", root)


if __name__ == "__main__":
    main()
