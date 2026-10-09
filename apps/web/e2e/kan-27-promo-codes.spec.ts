import { test, expect, type Page } from "@playwright/test";
import { createAccountAtCheckout } from "./auth";

// KAN-27: apply a promo code at checkout.
// Cases live in agentic-workflows/functional-testing/runs/KAN-27/spec.yaml; every
// asserted amount and message is that case's `expected`, not what the app shows.
// Test data (plan.md): Chef Verona (id 17), delivery fee 500 AMD, free from 5,000 AMD.

const CHEF = "/chef/17";
// Backend base for API reads: VITE_API_BASE_URL, else the deployed one-origin host, else local dev.
const API = process.env.VITE_API_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081";

type Dish = { name: string; price: number };
const TART: Dish = { name: "Tart with cherry", price: 1000 };
const GATHA: Dish = { name: "Gatha with dried apricots and thyme", price: 1050 };
const QUICHE_VEG: Dish = { name: "Quiche with vegetables", price: 1100 };
const QUICHE_MUSH: Dish = { name: "Quiche with mushrooms", price: 1200 };
const SPINACH_PIE: Dish = { name: "Spinach and feta cheese pie", price: 650 };
const BEAN_PIE: Dish = { name: "Pie with beans", price: 550 };
const BENTO: Dish = { name: "Bento cake", price: 5000 };

const amd = (value: number) => `${value.toLocaleString("en-US")} AMD`;

function orderDock(page: Page) {
  return page.getByRole("complementary").filter({ hasText: "Your order" });
}

function checkoutSummary(page: Page) {
  return page.getByRole("complementary").filter({ hasText: "Promo code" });
}

// Adds one unit per click and waits for the cart subtotal after each one, so quick
// clicks don't race on the IndexedDB cart. Returns the subtotal the case's steps state.
async function addDishes(page: Page, dishes: Dish[], startSubtotal = 0) {
  let subtotal = startSubtotal;
  for (const dish of dishes) {
    await page.getByRole("button", { name: `Add ${dish.name} to cart`, exact: true }).click();
    subtotal += dish.price;
    await expect(orderDock(page)).toContainText(new RegExp(`Subtotal\\s*${amd(subtotal)}`));
  }
  return subtotal;
}

async function openCheckout(page: Page) {
  await orderDock(page).getByRole("link", { name: "Go to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
}

async function startCase(page: Page, dishes: Dish[], customer: string) {
  await page.goto(CHEF);
  await addDishes(page, dishes);
  await openCheckout(page);
  await createAccountAtCheckout(page, customer);
  await page.getByRole("button", { name: "Delivery To your door" }).click();
}

async function applyCode(page: Page, code: string) {
  await page.getByLabel("Promo code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
}

async function expectDiscount(page: Page, code: string, discount: number) {
  await expect(checkoutSummary(page)).toContainText(
    new RegExp(`Discount \\(${code}\\)\\s*−${amd(discount)}`),
  );
}

async function expectNoDiscount(page: Page) {
  await expect(checkoutSummary(page).getByText(/^Discount \(/)).toHaveCount(0);
}

async function expectTotal(page: Page, total: number) {
  await expect(checkoutSummary(page)).toContainText(new RegExp(`Total\\s*${amd(total)}`));
}

async function expectMessage(page: Page, message: string) {
  await expect(checkoutSummary(page).getByRole("alert")).toHaveText(message);
}

// Waits for a code to be applied before the next step (no amount asserted).
async function waitApplied(page: Page, code: string) {
  await expect(checkoutSummary(page).getByText(`Discount (${code})`, { exact: true })).toBeVisible();
}

test.describe("KAN-27 promo code at checkout", () => {
  test("KAN-27-TC-01: SAVE10 at exactly its 3,000 AMD minimum with delivery gives 350 AMD off", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC01");

    await expect(page.getByLabel("Promo code", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeVisible();
    await applyCode(page, "SAVE10");

    await expectDiscount(page, "SAVE10", 350);
    await expectTotal(page, 3150);
    await expect(page.getByRole("button", { name: "Place order" })).toBeVisible();
  });

  test("KAN-27-TC-02: SAVE10 with a 2,950 AMD subtotal is rejected with the missing 50 AMD", async ({ page }) => {
    await startCase(page, [QUICHE_VEG, QUICHE_MUSH, SPINACH_PIE], "KAN27 TC02");
    await applyCode(page, "SAVE10");

    await expectMessage(page, "Add 50 AMD more to use this code");
    await expectNoDiscount(page);
    await expectTotal(page, 3450);
  });

  test("KAN-27-TC-03: TREAT15 on an 8,050 AMD subtotal gives 1,207 AMD off (rounded down)", async ({ page }) => {
    await startCase(page, [BENTO, TART, TART, GATHA], "KAN27 TC03");
    await applyCode(page, "TREAT15");

    await expectDiscount(page, "TREAT15", 1207);
    await expectTotal(page, 6843);
  });

  test("KAN-27-TC-04: TREAT15 with a 7,950 AMD subtotal is rejected with the missing 50 AMD", async ({ page }) => {
    await startCase(page, [BENTO, QUICHE_VEG, QUICHE_MUSH, SPINACH_PIE], "KAN27 TC04");
    await applyCode(page, "TREAT15");

    await expectMessage(page, "Add 50 AMD more to use this code");
    await expectNoDiscount(page);
    await expectTotal(page, 7950);
  });

  test("KAN-27-TC-05: Expired code OLD15 is rejected", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC05");
    await applyCode(page, "OLD15");

    await expectMessage(page, "This code has expired");
    await expectNoDiscount(page);
    await expectTotal(page, 3500);
  });

  test("KAN-27-TC-06: Unknown code NOPE99 is rejected", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC06");
    await applyCode(page, "NOPE99");

    await expectMessage(page, "Code not found");
    await expectNoDiscount(page);
    await expectTotal(page, 3500);
  });

  test('KAN-27-TC-07: Lower-case code with surrounding spaces " save10 " applies as SAVE10', async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC07");
    await applyCode(page, " save10 ");

    await expectDiscount(page, "SAVE10", 350);
    await expectTotal(page, 3150);
  });

  test("KAN-27-TC-08: Applying TREAT15 after SAVE10 replaces it", async ({ page }) => {
    await startCase(page, [BENTO, TART, TART, GATHA], "KAN27 TC08");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await applyCode(page, "TREAT15");

    await expect(checkoutSummary(page).getByText(/^Discount \(/)).toHaveCount(1);
    await expectDiscount(page, "TREAT15", 1207);
    await expectTotal(page, 6843);
    await expect(checkoutSummary(page).getByText("Discount (SAVE10)", { exact: true })).toHaveCount(0);
  });

  test("KAN-27-TC-09: Applying expired OLD15 after SAVE10 removes SAVE10", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC09");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await applyCode(page, "OLD15");

    await expectMessage(page, "This code has expired");
    await expectNoDiscount(page);
    await expectTotal(page, 3500);
  });

  test("KAN-27-TC-10: Removing SAVE10 restores the original total", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC10");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await page.getByRole("button", { name: "Remove promo code" }).click();

    await expectNoDiscount(page);
    await expectTotal(page, 3500);
  });

  test("KAN-27-TC-11: Switching from Delivery to Takeaway recalculates the SAVE10 discount", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC11");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    await page.getByRole("button", { name: "Takeaway Pick up" }).click();

    await expectDiscount(page, "SAVE10", 300);
    await expectTotal(page, 2700);
  });

  test("KAN-27-TC-12: Applied SAVE10 is dropped when the cart falls below 3,000 AMD", async ({ page }) => {
    await startCase(page, [TART, TART, GATHA], "KAN27 TC12");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    // The checkout has no quantity control; the cart's is on the chef page.
    // Cart lines have no role or label: the Tart line is the block with the Tart image
    // and a Decrease button that doesn't also hold the Gatha line.
    await page.goBack();
    const tartLine = orderDock(page)
      .locator("div")
      .filter({ has: page.getByRole("img", { name: TART.name, exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Decrease quantity" }) })
      .filter({ hasNotText: GATHA.name });
    await tartLine.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(orderDock(page)).toContainText(new RegExp(`Subtotal\\s*${amd(2050)}`));
    await openCheckout(page);
    await page.getByRole("button", { name: "Delivery To your door" }).click();

    await expectMessage(page, "Add 950 AMD more to use this code");
    await expectNoDiscount(page);
    await expectTotal(page, 2550);
  });

  test("KAN-27-TC-13: An order placed with SAVE10 keeps the 350 AMD discount", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC13");
    await applyCode(page, "SAVE10");
    await waitApplied(page, "SAVE10");

    const form = page.getByRole("form", { name: "Checkout" });
    await form.getByLabel("Full name").fill("KAN27 Tester");
    await form.getByLabel("Phone").fill("+37491000027");
    await form.getByLabel("Email").fill("kan27.tester@example.com");
    await page.getByLabel("City").fill("Yerevan");
    await page.getByLabel("Street").fill("Abovyan");
    await page.getByLabel("Building").fill("1");
    await page.getByLabel("Apartment").fill("1");
    await page.getByPlaceholder("Allergies, instructions, gate code...").fill("STLC KAN-27 KAN-27-TC-13");
    await page.getByLabel(/Cash on delivery/).click();
    await page.getByRole("button", { name: "Place order" }).click();

    // The order number is only exposed in the URL after placing the order.
    await page.waitForURL(/[?&]number=/);
    const number = new URL(page.url()).searchParams.get("number");
    expect(number).toBeTruthy();

    const res = await page.request.get(`${API}/api/order/number/${number}`);
    expect(res.ok()).toBeTruthy();
    const order = await res.json();
    expect(order.promoCode).toBe("SAVE10");
    expect(Number(order.discount)).toBe(350);
    expect(Number(order.totalPrice)).toBe(3150);

    await page.goto(`/tracking/${number}`);
    await expect(page.getByRole("main")).toContainText(new RegExp(`Total\\s*${amd(3150)}`));
  });

  test("KAN-27-TC-14: SAVE10 rejected at 2,950 AMD applies when re-applied after the cart grows to 3,500 AMD", async ({ page }) => {
    await startCase(page, [QUICHE_VEG, QUICHE_MUSH, SPINACH_PIE], "KAN27 TC14");
    await applyCode(page, "SAVE10");
    await expectMessage(page, "Add 50 AMD more to use this code");

    // Dishes are added on the chef page; checkout has no add control.
    await page.goBack();
    await addDishes(page, [BEAN_PIE], 2950);
    await openCheckout(page);
    await page.getByRole("button", { name: "Delivery To your door" }).click();

    // "With SAVE10 in Promo code, press Apply again": fill() keeps SAVE10 if it is still there.
    await applyCode(page, "SAVE10");

    await expectDiscount(page, "SAVE10", 400);
    await expectTotal(page, 3600);
  });

  test("KAN-27-TC-15: Apply with an empty or spaces-only Promo code applies nothing", async ({ page }) => {
    await startCase(page, [TART, TART, TART], "KAN27 TC15");
    const field = page.getByLabel("Promo code", { exact: true });
    const apply = page.getByRole("button", { name: "Apply", exact: true });

    // Apply may be disabled for these inputs; force presses it without waiting for it to enable.
    await field.fill("");
    await apply.click({ force: true });
    await expectNoDiscount(page);
    await expectTotal(page, 3500);

    await field.fill("   ");
    await apply.click({ force: true });
    await expectNoDiscount(page);
    await expectTotal(page, 3500);
  });
});
