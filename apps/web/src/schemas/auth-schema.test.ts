import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth-schema";

describe("loginSchema", () => {
  it("accepts a valid email and 8-char password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "12345678" }).success).toBe(true);
  });
  it("rejects a short password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "1234567" }).success).toBe(false);
  });
  it("rejects a malformed email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "12345678" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const ok = { fullName: "Ann", email: "a@b.co", phoneNumber: "12345678", password: "12345678" };
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects a short name and phone", () => {
    expect(registerSchema.safeParse({ ...ok, fullName: "A" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, phoneNumber: "1234567" }).success).toBe(false);
  });
});
