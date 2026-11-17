import { describe, expect, it } from "vitest";
import { checkoutSchema, type CheckoutFormValues } from "@/schemas/checkout-schema";

const valid: CheckoutFormValues = {
  receiverName: "Ani",
  receiverPhoneNumber: "+37491000000",
  receiverEmail: "ani@example.com",
  deliveryMethod: "DELIVERY",
  paymentType: "CASH",
  note: "",
  city: "Yerevan",
  street: "Abovyan 1",
  building: "",
  apartment: "",
};

const errorPaths = (values: unknown) => {
  const result = checkoutSchema.safeParse(values);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("checkoutSchema", () => {
  it("accepts a complete delivery order", () => {
    expect(errorPaths(valid)).toEqual([]);
  });

  it("rejects any payment type other than CASH", () => {
    expect(errorPaths({ ...valid, paymentType: "CARD" })).toEqual(["paymentType"]);
  });

  it("requires street and city for delivery", () => {
    expect(errorPaths({ ...valid, street: " ", city: "" }).sort()).toEqual(["city", "street"]);
  });

  it("does not require an address for takeaway", () => {
    expect(errorPaths({ ...valid, deliveryMethod: "TAKEAWAY", street: "", city: "" })).toEqual([]);
  });

  it("enforces the name, phone and note length limits", () => {
    expect(errorPaths({ ...valid, receiverName: "A" })).toEqual(["receiverName"]);
    expect(errorPaths({ ...valid, receiverPhoneNumber: "1234567" })).toEqual(["receiverPhoneNumber"]);
    expect(errorPaths({ ...valid, note: "x".repeat(301) })).toEqual(["note"]);
    expect(errorPaths({ ...valid, note: "x".repeat(300) })).toEqual([]);
  });
});
