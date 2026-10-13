import { expect, test } from "@playwright/test";

test("sample exploration searches raw content and shows the original event safely", async ({
  page,
}) => {
  const outgoing: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:1420/"))
      outgoing.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByText("Interface preview · synthetic data only.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore a synthetic sample" })
    .click();
  await expect(page.getByText("1–13 of 13 events")).toBeVisible();
  await page.getByRole("row").filter({ hasText: "<img src=" }).click();
  await expect(page.locator(".detail-panel .raw-event").first()).toContainText(
    "<img src=",
  );
  await expect(page.locator(".detail-panel img")).toHaveCount(0);
  await page.getByRole("button", { name: "Close event details" }).click();
  await page.getByRole("textbox", { name: "Search logs" }).fill("POST /LOGIN");
  await expect(page.getByText("1–2 of 2 events")).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "198.51.100.24" })
    .first()
    .click();
  await expect(
    page.getByRole("complementary", { name: "Event details" }),
  ).toBeVisible();
  await expect(page.locator(".raw-event").first()).toContainText(
    '"POST /login HTTP/1.1" 401',
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Event details" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Warnings", exact: false }).click();
  await expect(page.getByText("1–1 of 1 events")).toBeVisible();
  await page.getByRole("row").filter({ hasText: "[invalid date]" }).click();
  await expect(
    page.getByText("Invalid Apache timestamp or timezone."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(outgoing).toEqual([]);
});

test("cancellation returns to the empty session", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore a synthetic sample" })
    .click();
  await page.getByRole("button", { name: "Cancel import" }).click();
  await expect(
    page.getByText("Import cancelled. No events from this import were kept."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every log tells a story." }),
  ).toBeVisible();
});

test("search is literal, empty results are explained, and browser imports are explicit", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Import log file", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Open the desktop application",
  );
  await page
    .getByRole("button", { name: "Explore a synthetic sample" })
    .click();
  await page.getByRole("textbox", { name: "Search logs" }).fill("' OR 1=1 --");
  await expect(page.getByText("No matching events")).toBeVisible();
  await expect(page.getByText("0–0 of 0 events")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByText("1–13 of 13 events")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Search logs" }),
  ).toBeFocused();
  await page.screenshot({
    path: "/tmp/dfir-mvp0-explorer.png",
    fullPage: true,
  });
});
