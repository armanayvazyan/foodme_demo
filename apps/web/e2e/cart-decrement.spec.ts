import { test, expect } from "@playwright/test";

// Regression for SCRUM-5 / FM-BUG-07: clicking "Decrease quantity" once on a
// cart line with quantity 2 removed the whole line instead of leaving 1.
test.describe("Cart decrement", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await page.locator("a.cc_card").first().click();
    await expect(page).toHaveURL(/\/chef\/\d+/);
  });

  async function addSameDishTwice(page: import("@playwright/test").Page) {
    const dish = page.locator("button.dc_card").first();
    const cart = page.locator("aside.uc-panel");
    for (const expected of ["1", "2"]) {
      await dish.click();
      await page.getByRole("button", { name: "Add to cart" }).click();
      await expect(cart.locator(".fm-qty-grp p")).toHaveText(expected);
    }
    return cart;
  }

  test("minus at quantity 2 leaves the item with quantity 1", async ({ page }) => {
    const cart = await addSameDishTwice(page);

    await cart.getByRole("button", { name: "Decrease quantity" }).click();

    await expect(cart.locator(".cic_root")).toHaveCount(1);
    await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");
  });

  test("minus at quantity 1 removes the item", async ({ page }) => {
    const cart = await addSameDishTwice(page);

    await cart.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");
    await cart.getByRole("button", { name: "Decrease quantity" }).click();

    await expect(cart.locator(".cic_root")).toHaveCount(0);
    await expect(cart.getByText(/empty/i)).toBeVisible();
  });

  test("minus at quantity 3 steps down one at a time", async ({ page }) => {
    const cart = await addSameDishTwice(page);
    await cart.getByRole("button", { name: "Increase quantity" }).click();
    await expect(cart.locator(".fm-qty-grp p")).toHaveText("3");

    await cart.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(cart.locator(".fm-qty-grp p")).toHaveText("2");
    await cart.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(cart.locator(".fm-qty-grp p")).toHaveText("1");
  });
});
