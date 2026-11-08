import { describe, expect, it } from "vitest";
import { checkoutSchema, type CheckoutFormValues } from "./checkout-schema";

function validTakeaway(overrides: Partial<CheckoutFormValues> = {}): CheckoutFormValues {
  return {
    receiverName: "Ann Test",
    receiverPhoneNumber: "+37491234567",
    receiverEmail: "ann@example.com",
    deliveryMethod: "TAKEAWAY",
    paymentType: "CASH",
    note: "",
    city: "",
    street: "",
    building: "",
    apartment: "",
    ...overrides,
  };
}

function issuePaths(values: unknown): string[] {
  const result = checkoutSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("checkoutSchema", () => {
  it("accepts a takeaway order without an address", () => {
    expect(checkoutSchema.safeParse(validTakeaway()).success).toBe(true);
  });

  it("requires city and street for delivery", () => {
    expect(issuePaths(validTakeaway({ deliveryMethod: "DELIVERY" }))).toEqual(["street", "city"]);
  });

  it("treats whitespace-only address fields as missing", () => {
    const values = validTakeaway({ deliveryMethod: "DELIVERY", city: "  ", street: "Abovyan" });
    expect(issuePaths(values)).toEqual(["city"]);
  });

  it("accepts delivery with city and street", () => {
    const values = validTakeaway({
      deliveryMethod: "DELIVERY",
      city: "Yerevan",
      street: "Abovyan",
    });
    expect(checkoutSchema.safeParse(values).success).toBe(true);
  });

  it.each([
    ["receiverName", "A"],
    ["receiverPhoneNumber", "1234567"],
    ["receiverEmail", "not-an-email"],
    ["note", "x".repeat(301)],
  ] as const)("rejects an invalid %s", (field, value) => {
    expect(issuePaths(validTakeaway({ [field]: value }))).toEqual([field]);
  });

  it("only allows cash payment", () => {
    expect(issuePaths({ ...validTakeaway(), paymentType: "CARD" })).toEqual(["paymentType"]);
  });
});
