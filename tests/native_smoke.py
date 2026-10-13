"""Exercise real Linux Tauri IPC through tauri-driver (synthetic data only).

Start tauri-driver inside an Xvfb/DBus session, then run:
    python3 tests/native_smoke.py /absolute/path/to/dfir-log-explorer
"""

import base64
import http.client
import json
import pathlib
import sys
import time

URL = "http://127.0.0.1:4444"
ELEMENT = "element-6066-11e4-a52e-4f735466cecf"
CONNECTION = http.client.HTTPConnection("127.0.0.1", 4444, timeout=30)


def command(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    # urllib forces Connection: close. Use a persistent connection so the
    # intermediary does not race a reused, already-closed WebKit connection.
    CONNECTION.request(method, path, body=data, headers={
        "Content-Type": "application/json", "Connection": "keep-alive",
    })
    response = CONNECTION.getresponse()
    body = response.read().decode()
    if response.status >= 400:
        raise RuntimeError(body)
    value = json.loads(body).get("value")
    if isinstance(value, dict) and "error" in value:
        raise RuntimeError(value)
    return value


def wait_for(fn, seconds=20):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            value = fn()
            if value:
                return value
        except RuntimeError:
            pass
        time.sleep(0.1)
    raise AssertionError("Native application did not reach the expected state")


def main():
    binary = str(pathlib.Path(sys.argv[1]).resolve())
    result = command("POST", "/session", {
        "capabilities": {"alwaysMatch": {"tauri:options": {"application": binary}}}
    })
    session = result["sessionId"]
    root = f"/session/{session}"

    def script(code):
        return command("POST", root + "/execute/sync", {"script": code, "args": []})

    def click(selector):
        element = command("POST", root + "/element", {"using": "css selector", "value": selector})
        command("POST", root + f"/element/{element[ELEMENT]}/click", {})

    try:
        wait_for(lambda: script("return !!document.querySelector('.sample-button')"))
        assert not script("return !!document.querySelector('.preview-banner')"), "Native app must not use preview bridge"
        click(".sample-button")
        wait_for(lambda: script("return document.querySelector('.table-footer')?.textContent.includes('1–13 of 13 events')"))
        assert script("return document.querySelectorAll('[role=row]').length") > 1
        click(".table-row")
        wait_for(lambda: script("return !!document.querySelector('.detail-panel .raw-event')"))
        assert '"GET / HTTP/1.1" 200' in script("return document.querySelector('.detail-panel .raw-event').textContent")
        click("[aria-label='Close event details']")
        click(".filter-button")
        wait_for(lambda: script("return document.querySelector('.table-footer')?.textContent.includes('1–1 of 1 events')"))
        click(".table-row")
        wait_for(lambda: script("return document.querySelector('.detail-warning')?.textContent.includes('Invalid Apache timestamp')"))
        # The invoke is exercised here against the production Rust handler; this
        # is a parameterized literal search, not the browser sample's adapter.
        search_result = command("POST", root + "/execute/async", {
            "script": "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('query_events', { query: { search: 'POST /LOGIN', onlyWarnings: false, offset: 0, limit: 500 } }).then(done).catch(e => done({error: String(e)}));",
            "args": [],
        })
        assert search_result["total"] == 2
        assert search_result["rows"][0]["sourceIp"] == "198.51.100.24"
        def query(criteria):
            payload = {"search": "", "onlyWarnings": False, "offset": 0, "limit": 500, **criteria}
            return command("POST", root + "/execute/async", {
                "script": "const done = arguments[arguments.length - 1]; window.__TAURI_INTERNALS__.invoke('query_events', {query: " + json.dumps(payload) + "}).then(done).catch(e => done({error: String(e)}));",
                "args": [],
            })

        partial = query({"parseStatus": "partial"})
        assert partial["total"] == 1
        assert partial["rows"][0]["parseStatus"] == "partial"
        assert partial["rows"][0]["sourceIp"] == "192.0.2.14"
        assert partial["rows"][0]["timestamp"] is None
        assert partial["statistics"]["missingTimestamp"] == 1
        unknown = query({"parseStatus": "unparsed", "searchField": "raw", "search": "<img src="})
        assert unknown["total"] == 1
        assert unknown["rows"][0]["lineNumber"] == 11
        sorted_events = query({"sortBy": "status", "descending": True, "limit": 1})
        assert sorted_events["rows"][0]["status"] == 502
        assert sorted_events["statistics"]["responses"] == [7, 0, 4, 1]
        click("[aria-label='Close event details']")
        click(".filter-button")
        wait_for(lambda: script("return document.querySelector('.table-footer')?.textContent.includes('1–13 of 13 events')"))
        screenshot = command("GET", root + "/screenshot")
        pathlib.Path("/tmp/dfir-mvp0-native.png").write_bytes(base64.b64decode(screenshot))
        print("Native smoke passed: real import, query, detail, parsing states, global statistics/sorting, warning filter, and local desktop bridge.")
    finally:
        command("DELETE", root)


if __name__ == "__main__":
    main()
