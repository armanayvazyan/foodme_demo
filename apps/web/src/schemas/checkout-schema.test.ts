import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./checkout-schema";

const valid = {
  receiverName: "Ann",
  receiverPhoneNumber: "+37499123456",
  receiverEmail: "ann@example.com",
  deliveryMethod: "DELIVERY" as const,
  paymentType: "CASH" as const,
  note: "",
  city: "Yerevan",
  street: "Abovyan",
  building: "1",
  apartment: "2",
};

describe("checkoutSchema", () => {
  it("accepts a complete delivery order", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("requires street and city for delivery", () => {
    const r = checkoutSchema.safeParse({ ...valid, street: " ", city: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["city", "street"]);
    }
  });

  it("does not require an address for takeaway", () => {
    const r = checkoutSchema.safeParse({ ...valid, deliveryMethod: "TAKEAWAY", street: "", city: "" });
    expect(r.success).toBe(true);
  });

  it("rejects a note over 300 characters", () => {
    expect(checkoutSchema.safeParse({ ...valid, note: "x".repeat(301) }).success).toBe(false);
  });
});
