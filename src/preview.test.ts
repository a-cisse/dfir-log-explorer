import { describe, expect, it } from "vitest";
import { previewBridge } from "./preview";

describe("browser preview data boundary", () => {
  it("refuses real file imports and exposes only the synthetic sample", async () => {
    await expect(previewBridge.pickFile()).rejects.toThrow(
      "synthetic data only",
    );
    await expect(previewBridge.importFile("auto", () => {})).rejects.toThrow(
      "desktop application",
    );
    await previewBridge.importDemo(() => {});
    const result = await previewBridge.query({
      search: "/login",
      onlyWarnings: false,
      offset: 0,
      limit: 500,
    });
    expect(result.total).toBe(2);
    expect(result.rows.every((row) => row.sourceIp === "198.51.100.24")).toBe(
      true,
    );
  });
});
