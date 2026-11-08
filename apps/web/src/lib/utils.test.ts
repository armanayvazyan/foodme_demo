import { describe, expect, it } from "vitest";
import { formatAmd, sameLabel, translate } from "./utils";

describe("formatAmd", () => {
  it("rounds to whole dram and adds thousands separators", () => {
    expect(formatAmd(1234.6)).toBe("1,235 AMD");
  });

  it("formats zero", () => {
    expect(formatAmd(0)).toBe("0 AMD");
  });
});

describe("translate", () => {
  const list = [
    { lang: "hy", value: "Բարեւ" },
    { lang: "en", value: "Hello" },
  ];

  it("returns the value for the requested language", () => {
    expect(translate(list, "hy")).toBe("Բարեւ");
  });

  it("defaults to English", () => {
    expect(translate(list)).toBe("Hello");
  });

  it("falls back to the first entry when the language is missing", () => {
    expect(translate(list, "ru")).toBe("Բարեւ");
  });

  it("returns an empty string for missing or empty lists", () => {
    expect(translate(undefined)).toBe("");
    expect(translate([])).toBe("");
  });
});

describe("sameLabel", () => {
  it("ignores case and accents", () => {
    expect(sameLabel("Cafe", "café")).toBe(true);
  });

  it("distinguishes different words", () => {
    expect(sameLabel("Soup", "Salad")).toBe(false);
  });
});
