import { test, expect, type Page } from "@playwright/test";
import { createAccountAtCheckout } from "./auth";

// KAN-27: apply a promo code at checkout.
// Cases live in agentic-workflows/functional-testing/runs/KAN-27/spec.yaml. Every
// asserted amount and message is that case's `expected`, not what the app shows.
// Test data (plan.md): Chef Verona (id 17), delivery fee 500 AMD, free from 5,000 AMD.

const CHEF = "/chef/17";
// Backend base for API reads: VITE_API_BASE_URL, else the one-origin deployed host, else local dev.
const API = (
  process.env.VITE_API_BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://localhost:8081"
).replace(/\/$/, "");

type Dish = { name: string; price: number };
const RICE: Dish = { name: "Rice", price: 1000 };
const SOUP: Dish = { name: "Mushroom soup", price: 1950 };
const QUICHE: Dish = { name: "Quiche with vegetables", price: 1100 };
const BENTO: Dish = { name: "Bento cake", price: 5000 };

type Method = "Delivery" | "Takeaway";

const amd = (value: number) => `${value.toLocaleString("en-US")} AMD`;

// The cart on the chef page.
function orderDock(page: Page) {
  return page.getByRole("complementary").filter({ hasText: "Your order" });
}

// The order summary on the checkout page.
function summary(page: Page) {
  return page.getByRole("complementary").filter({ hasText: "Promo code" });
}

// One click adds one unit. Waits for the cart subtotal after each click, so quick
// clicks don't race on the browser-side cart.
async function addDishes(page: Page, dishes: Dish[]) {
  let subtotal = 0;
  for (const dish of dishes) {
    await page.getByRole("button", { name: `Add ${dish.name} to cart`, exact: true }).click();
    subtotal += dish.price;
    await expect(orderDock(page)).toContainText(new RegExp(`Subtotal\\s*${amd(subtotal)}`));
  }
}

async function openCheckout(page: Page) {
  await orderDock(page).getByRole("link", { name: "Go to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

async function chooseMethod(page: Page, method: Method) {
  await page.getByRole("button", { name: new RegExp(`^${method}`) }).click();
}

// Steps 1-3 of every case: own customer, own cart, delivery method chosen.
async function startCase(page: Page, dishes: Dish[], method: Method, customer: string) {
  await page.goto(CHEF);
  await addDishes(page, dishes);
  await openCheckout(page);
  await createAccountAtCheckout(page, customer);
  await chooseMethod(page, method);
}

async function applyCode(page: Page, code: string) {
  await page.getByLabel("Promo code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}

// The discount line reads "Discount (<code>)" followed by the amount.
async function expectDiscount(page: Page, code: string, discount: number) {
  await expect(summary(page)).toContainText(
    new RegExp(`Discount \\(${code}\\)\\s*[−-]?\\s*${amd(discount)}`),
  );
}

async function expectNoDiscount(page: Page) {
  await expect(summary(page).getByText(/^Discount \(/)).toHaveCount(0);
}

async function expectTotal(page: Page, total: number) {
  // "Subtotal" doesn't match: the pattern is case sensitive.
  await expect(summary(page)).toContainText(new RegExp(`Total\\s*${amd(total)}`));
}

async function expectMessage(page: Page, message: string) {
  await expect(summary(page).getByText(message, { exact: true })).toBeVisible();
}

// Waits until a code is applied before the next step. No amount is asserted here:
// the amounts a case's steps mention on the way are not its `expected`.
async function waitApplied(page: Page, code: string) {
  await expect(summary(page).getByText(`Discount (${code})`, { exact: true })).toBeVisible();
}

test.describe("KAN-27 promo code at checkout", () => {
  test("KAN-27-TC-01: SAVE10 at exactly its 3,000 AMD minimum takes 10% off the subtotal and leaves the delivery fee alone", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Delivery", "KAN27 TC01");
    await applyCode(page, "SAVE10");

    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 3200);
    // "Before the order is placed": the order can still be placed from this page.
    await expect(page.getByRole("button", { name: "Place order" })).toBeVisible();
  });

  test("KAN-27-TC-02: SAVE10 with a 2,950 AMD subtotal is rejected with the missing amount", async ({ page }) => {
    await startCase(page, [SOUP, RICE], "Takeaway", "KAN27 TC02");
    await applyCode(page, "SAVE10");

    await expectMessage(page, "Add 50 AMD more to use this code");
    await expectNoDiscount(page);
    await expectTotal(page, 2950);
  });

  test("KAN-27-TC-03: TREAT15 at exactly its 8,000 AMD minimum takes 15% off the subtotal", async ({ page }) => {
    await startCase(page, [BENTO, RICE, RICE, RICE], "Takeaway", "KAN27 TC03");
    await applyCode(page, "TREAT15");

    await expectDiscount(page, "TREAT15", 1200);
    await expectTotal(page, 6800);
  });

  test("KAN-27-TC-04: The promo field has a visible label, the buttons have accessible names, and the texts follow the selected language", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC04");

    await expect(summary(page).getByText("Promo code", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Promo code", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();

    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");
    await expect(page.getByRole("button", { name: "Remove promo code", exact: true })).toBeVisible();

    // Step 7: switch the site language to Armenian. Step 05 found no language control on
    // the storefront, so there is no known name to select it by; this looks for one by role.
    await page.getByRole("button", { name: /language|armenian|հայերեն/i }).click();

    await expect(summary(page).getByText("Promo code", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove promo code", exact: true })).toHaveCount(0);
    await expect(summary(page).getByText("Discount (SAVE10)", { exact: true })).toHaveCount(0);
  });

  test("KAN-27-TC-05: TREAT15 on an 8,050 AMD subtotal rounds the 1,207.5 AMD discount down to 1,207 AMD", async ({ page }) => {
    await startCase(page, [BENTO, SOUP, QUICHE], "Takeaway", "KAN27 TC05");
    await applyCode(page, "TREAT15");

    await expectDiscount(page, "TREAT15", 1207);
    await expectTotal(page, 6843);
  });

  test("KAN-27-TC-06: The expired code OLD15 is rejected", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC06");
    await applyCode(page, "OLD15");

    await expectMessage(page, "This code has expired");
    await expectNoDiscount(page);
    await expectTotal(page, 3000);
  });

  test("KAN-27-TC-07: The unknown code NOPE99 is rejected", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC07");
    await applyCode(page, "NOPE99");

    await expectMessage(page, "Code not found");
    await expectNoDiscount(page);
    await expectTotal(page, 3000);
  });

  test("KAN-27-TC-08: SAVE10 typed in lower case, or with spaces around it, still applies", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC08");

    await applyCode(page, "save10");
    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 2700);
    await expect(summary(page).getByText("Code not found", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Remove promo code", exact: true }).click();
    // Wait for the removal before the second apply.
    await expectNoDiscount(page);

    await applyCode(page, " SAVE10 ");
    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 2700);
    await expect(summary(page).getByText("Code not found", { exact: true })).toHaveCount(0);
  });

  test("KAN-27-TC-09: Applying TREAT15 while SAVE10 is applied replaces SAVE10", async ({ page }) => {
    await startCase(page, [BENTO, RICE, RICE, RICE], "Takeaway", "KAN27 TC09");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await applyCode(page, "TREAT15");

    await expectDiscount(page, "TREAT15", 1200);
    await expect(summary(page).getByText(/^Discount \(/)).toHaveCount(1);
    await expect(summary(page).getByText(/SAVE10/)).toHaveCount(0);
    await expectTotal(page, 6800);
  });

  test("KAN-27-TC-10: A rejected second code (OLD15) leaves the applied SAVE10 in place", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC10");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await applyCode(page, "OLD15");

    await expectMessage(page, "This code has expired");
    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 2700);
  });

  test("KAN-27-TC-11: Removing the applied SAVE10 puts the total back to the original", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC11");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await page.getByRole("button", { name: "Remove promo code", exact: true }).click();

    await expectNoDiscount(page);
    await expectTotal(page, 3000);
  });

  test("KAN-27-TC-12: Switching the delivery method with SAVE10 applied recalculates the total and keeps the discount on the subtotal", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Delivery", "KAN27 TC12");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await chooseMethod(page, "Takeaway");
    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 2700);

    await chooseMethod(page, "Delivery");
    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 3200);
  });

  test("KAN-27-TC-13: An order placed with SAVE10 keeps the code and the discount", async ({ page }) => {
    await startCase(page, [RICE, RICE, RICE], "Takeaway", "KAN27 TC13");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    const form = page.getByRole("form", { name: "Checkout" });
    await form.getByLabel("Full name").fill("Test Customer");
    await form.getByLabel("Phone").fill("+37499000027");
    await form.getByLabel("Email").fill("kan27@example.com");
    await page.getByRole("textbox", { name: /Allergies/ }).fill("STLC KAN-27 KAN-27-TC-13");
    await page.getByRole("button", { name: "Place order" }).click();

    // The order is placed: the app moves to the success page, which carries the order number.
    await expect(page).toHaveURL(/\/orders\/success\?(.*&)?number=/);
    const number = new URL(page.url()).searchParams.get("number");
    expect(number).toBeTruthy();

    const res = await page.request.get(`${API}/api/order/number/${number}`);
    expect(res.ok()).toBeTruthy();
    const order = await res.json();
    expect(order.promoCode).toBe("SAVE10");
    expect(Number(order.discount)).toBe(300);
  });

  test("KAN-27-TC-14: SAVE10 is taken off with the missing amount when the subtotal drops below 3,000 AMD", async ({ page }) => {
    await startCase(page, [SOUP, RICE, RICE], "Takeaway", "KAN27 TC14");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    // The checkout has no quantity control (step 05), so Rice is reduced in the cart on
    // the chef page. Cart lines have no role or label: the Rice line is the block with the
    // text "Rice" and a Decrease button that doesn't also hold the Mushroom soup line.
    await page.goBack();
    const riceLine = orderDock(page)
      .locator("div")
      .filter({ has: page.getByText(RICE.name, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Decrease quantity" }) })
      .filter({ hasNotText: SOUP.name });
    await riceLine.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(orderDock(page)).toContainText(new RegExp(`Subtotal\\s*${amd(2950)}`));
    await openCheckout(page);
    await chooseMethod(page, "Takeaway");

    await expectNoDiscount(page);
    await expectMessage(page, "Add 50 AMD more to use this code");
    await expectTotal(page, 2950);
  });
});
