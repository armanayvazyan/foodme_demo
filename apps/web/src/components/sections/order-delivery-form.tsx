import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, CreditCard, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DeliveryTypeInput } from "@/components/sections/delivery-type-input";
import { PhoneInput } from "@/components/sections/phone-input";
import { cn } from "@/lib/utils";
import { checkoutSchema, type CheckoutFormValues } from "@/schemas/checkout-schema";
import type { DeliveryMethod } from "@/types";

interface OrderDeliveryFormProps {
  onSubmit: (values: CheckoutFormValues) => void;
  onDeliveryMethodChange?: (method: DeliveryMethod) => void;
  deliveryMethods?: DeliveryMethod[];
  defaultContact?: {
    receiverName?: string;
    receiverPhoneNumber?: string;
    receiverEmail?: string;
  };
  embedded?: boolean;
}

type PaymentChoice = "CASH" | "CARD" | "IDRAM";

const paymentOptions = [
  {
    value: "CASH",
    label: "Cash on delivery",
    hint: "Pay at the door",
    Icon: Banknote,
  },
  {
    value: "CARD",
    label: "Bank card",
    hint: "Visa or Mastercard",
    Icon: CreditCard,
  },
  {
    value: "IDRAM",
    label: "Idram",
    hint: "Pay from wallet",
    Icon: Wallet,
  },
] satisfies {
  value: PaymentChoice;
  label: string;
  hint: string;
  Icon: typeof Banknote;
}[];

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="space-y-3 px-5 py-5">{children}</section>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[13px] font-semibold tracking-wide text-zinc-500">{children}</h2>;
}

export function OrderDeliveryForm({
  onSubmit,
  onDeliveryMethodChange,
  deliveryMethods,
  defaultContact,
  embedded = false,
}: OrderDeliveryFormProps) {
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("CASH");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      deliveryMethod: "DELIVERY",
      paymentType: "CASH",
      note: "",
      city: "",
      street: "",
      building: "",
      apartment: "",
      receiverName: defaultContact?.receiverName ?? "",
      receiverPhoneNumber: defaultContact?.receiverPhoneNumber ?? "",
      receiverEmail: defaultContact?.receiverEmail ?? "",
    },
  });

  useEffect(() => {
    if (!defaultContact) return;
    const current = getValues();
    if (!current.receiverName.trim() && defaultContact.receiverName) {
      setValue("receiverName", defaultContact.receiverName);
    }
    if (!current.receiverPhoneNumber.trim() && defaultContact.receiverPhoneNumber) {
      setValue("receiverPhoneNumber", defaultContact.receiverPhoneNumber);
    }
    if (!current.receiverEmail.trim() && defaultContact.receiverEmail) {
      setValue("receiverEmail", defaultContact.receiverEmail);
    }
  }, [defaultContact, getValues, setValue]);

  const deliveryMethod = useWatch({ control, name: "deliveryMethod" });
  const allowedMethods = useMemo<DeliveryMethod[]>(
    () => (deliveryMethods && deliveryMethods.length > 0 ? deliveryMethods : ["DELIVERY", "TAKEAWAY"]),
    [deliveryMethods],
  );

  useEffect(() => {
    if (!allowedMethods.includes(deliveryMethod)) {
      const next = allowedMethods[0];
      setValue("deliveryMethod", next);
      onDeliveryMethodChange?.(next);
    }
  }, [allowedMethods, deliveryMethod, onDeliveryMethodChange, setValue]);

  return (
    <form
      id="checkout-form"
      aria-label="Checkout"
      className={cn("odf_form", !embedded && "bezel-outer shadow-diffuse")}
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className={cn("divide-y divide-zinc-100", !embedded && "bezel-inner")}>
        <Section>
          <SectionTitle>Delivery method</SectionTitle>
          <DeliveryTypeInput
            value={deliveryMethod}
            allowed={allowedMethods}
            onChange={(v: DeliveryMethod) => {
              setValue("deliveryMethod", v);
              onDeliveryMethodChange?.(v);
            }}
          />
        </Section>

        <Section>
          <SectionTitle>Contact</SectionTitle>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <FieldGroup>
              <Label htmlFor="receiverName">Full name</Label>
              <Input
                id="receiverName"
                placeholder="Ara Petrosyan"
                aria-invalid={!!errors.receiverName}
                aria-describedby={errors.receiverName ? "receiverName-error" : undefined}
                className={errors.receiverName ? "border-red-400 focus-visible:border-red-500" : ""}
                {...register("receiverName")}
              />
              {errors.receiverName && (
                <p id="receiverName-error" className="text-xs text-red-600">
                  {errors.receiverName.message}
                </p>
              )}
            </FieldGroup>
            <FieldGroup>
              <Label htmlFor="receiverPhoneNumber">Phone</Label>
              <PhoneInput
                id="receiverPhoneNumber"
                aria-invalid={!!errors.receiverPhoneNumber}
                aria-describedby={errors.receiverPhoneNumber ? "receiverPhoneNumber-error" : undefined}
                className={
                  errors.receiverPhoneNumber ? "border-red-400 focus-visible:border-red-500" : ""
                }
                {...register("receiverPhoneNumber")}
              />
              {errors.receiverPhoneNumber && (
                <p id="receiverPhoneNumber-error" className="text-xs text-red-600">
                  {errors.receiverPhoneNumber.message}
                </p>
              )}
            </FieldGroup>
            <div className="sm:col-span-2">
              <FieldGroup>
                <Label htmlFor="receiverEmail">Email</Label>
                <Input
                  id="receiverEmail"
                  type="email"
                  placeholder="ara@example.com"
                  aria-invalid={!!errors.receiverEmail}
                  aria-describedby={errors.receiverEmail ? "receiverEmail-error" : undefined}
                  className={errors.receiverEmail ? "border-red-400 focus-visible:border-red-500" : ""}
                  {...register("receiverEmail")}
                />
                {errors.receiverEmail && (
                  <p id="receiverEmail-error" className="text-xs text-red-600">
                    {errors.receiverEmail.message}
                  </p>
                )}
              </FieldGroup>
            </div>
          </div>
        </Section>

        {deliveryMethod === "DELIVERY" && (
          <Section>
            <SectionTitle>Delivery address</SectionTitle>
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <FieldGroup>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Yerevan"
                  aria-invalid={!!errors.city}
                  aria-describedby={errors.city ? "city-error" : undefined}
                  className={errors.city ? "border-red-400 focus-visible:border-red-500" : ""}
                  {...register("city")}
                />
                {errors.city && (
                  <p id="city-error" className="text-xs text-red-600">
                    {errors.city.message}
                  </p>
                )}
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="street">Street</Label>
                <Input
                  id="street"
                  placeholder="Barekamutyan"
                  aria-invalid={!!errors.street}
                  aria-describedby={errors.street ? "street-error" : undefined}
                  className={errors.street ? "border-red-400 focus-visible:border-red-500" : ""}
                  {...register("street")}
                />
                {errors.street && (
                  <p id="street-error" className="text-xs text-red-600">
                    {errors.street.message}
                  </p>
                )}
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="building">Building</Label>
                <Input id="building" placeholder="14" {...register("building")} />
              </FieldGroup>
              <FieldGroup>
                <Label htmlFor="apartment">Apartment</Label>
                <Input id="apartment" placeholder="37" {...register("apartment")} />
              </FieldGroup>
            </div>
          </Section>
        )}

        <Section>
          <SectionTitle>Note (optional)</SectionTitle>
          <textarea
            id="note"
            className={[
              "w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900",
              "placeholder:text-zinc-400",
              "shadow-[0_1px_3px_-1px_rgba(0,0,0,0.05)]",
              "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
              "hover:border-zinc-300",
              "focus-visible:outline-none focus-visible:border-zinc-400 focus-visible:ring-4 focus-visible:ring-zinc-100",
            ].join(" ")}
            rows={3}
            placeholder="Allergies, instructions, gate code..."
            {...register("note")}
          />
        </Section>

        <Section>
          <SectionTitle>Payment</SectionTitle>
          <RadioGroup
            value={paymentChoice}
            onValueChange={(value) => setPaymentChoice(value as PaymentChoice)}
            className="grid gap-3 sm:grid-cols-3"
            aria-label="Payment method"
          >
            {paymentOptions.map(({ value, label, hint, Icon }) => {
              const selected = paymentChoice === value;
              const id = `payment-${value.toLowerCase()}`;

              return (
                <label
                  key={value}
                  htmlFor={id}
                  className={cn(
                    "flex min-h-[5.75rem] cursor-pointer flex-col rounded-xl border p-3",
                    "transition-[border-color,background-color] duration-200",
                    selected
                      ? "border-zinc-900 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        selected ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      <Icon size={16} strokeWidth={1.8} />
                    </span>
                    <RadioGroupItem
                      value={value}
                      id={id}
                      className={
                        selected
                          ? "border-white bg-white data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:[&>span>div]:bg-zinc-950"
                          : undefined
                      }
                    />
                  </div>
                  <div className="mt-auto pt-3">
                    <p className="text-[13px] font-semibold leading-4">{label}</p>
                    <p className={cn("mt-1 text-[11px] leading-4", selected ? "text-zinc-300" : "text-zinc-500")}>
                      {hint}
                    </p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>
        </Section>
      </div>
    </form>
  );
}
