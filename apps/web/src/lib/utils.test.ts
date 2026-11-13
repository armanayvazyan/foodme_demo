import { describe, expect, it } from "vitest";
import { formatAmd, sameLabel, translate } from "./utils";

describe("formatAmd", () => {
  it("rounds and groups thousands", () => {
    expect(formatAmd(1234.6)).toBe("1,235 AMD");
  });
});

describe("translate", () => {
  const list = [
    { lang: "hy", value: "Խաշլամա" },
    { lang: "en", value: "Khashlama" },
  ];
  it("picks the requested language", () => {
    expect(translate(list, "en")).toBe("Khashlama");
  });
  it("falls back to the first entry", () => {
    expect(translate(list, "ru")).toBe("Խաշլամա");
  });
  it("returns an empty string for a missing list", () => {
    expect(translate(undefined)).toBe("");
  });
});

describe("sameLabel", () => {
  it("ignores case", () => {
    expect(sameLabel("Soup", "soup")).toBe(true);
  });
  it("tells different labels apart", () => {
    expect(sameLabel("Soup", "Salad")).toBe(false);
  });
});
