import { describe, expect, it } from "vitest";
import { formatAmd, sameLabel, translate } from "@/lib/utils";

describe("formatAmd", () => {
  it("rounds to whole drams and groups thousands", () => {
    expect(formatAmd(12345.5)).toBe("12,346 AMD");
    expect(formatAmd(999.4)).toBe("999 AMD");
  });
});

describe("translate", () => {
  const names = [
    { lang: "hy", value: "Խորոված" },
    { lang: "en", value: "Khorovats" },
  ];

  it("returns the value for the requested language", () => {
    expect(translate(names, "hy")).toBe("Խորոված");
  });

  it("defaults to English", () => {
    expect(translate(names)).toBe("Khorovats");
  });

  it("falls back to the first entry when the language is missing", () => {
    expect(translate(names, "ru")).toBe("Խորոված");
  });

  it("returns an empty string for a missing or empty list", () => {
    expect(translate(undefined)).toBe("");
    expect(translate([])).toBe("");
  });
});

describe("sameLabel", () => {
  it("ignores case and accents", () => {
    expect(sameLabel("Cafe", "café")).toBe(true);
  });

  it("is false for different labels", () => {
    expect(sameLabel("Pizza", "Pasta")).toBe(false);
  });
});
