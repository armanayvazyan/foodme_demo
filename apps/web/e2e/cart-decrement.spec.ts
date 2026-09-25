import { test, expect } from "@playwright/test";

// FM-BUG-07 / KAN-19: "−" must lower quantity by one, removing only at the minimum.
test("decreasing cart quantity lowers it by one and removes only at minimum", async ({ page }) => {
  await page.goto("/explore");
  await page.locator("a.cc_card").first().click();
  await expect(page).toHaveURL(/\/chef\/\d+/);

  await page.locator("button.dc_card").first().click();
  await page.getByRole("button", { name: "Add to cart" }).click();

  const cartPanel = page.locator("aside.uc-panel");
  const cartItem = cartPanel.locator(".cic_root");
  const quantity = cartItem.locator(".fm-qty-grp p");
  await expect(cartItem).toHaveCount(1);
  await expect(quantity).toHaveText("1");

  await cartItem.getByRole("button", { name: "Increase quantity" }).click();
  await expect(quantity).toHaveText("2");

  await cartItem.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(cartItem).toHaveCount(1);
  await expect(quantity).toHaveText("1");

  await cartItem.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(cartItem).toHaveCount(0);
});
