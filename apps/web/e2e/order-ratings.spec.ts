import { test, expect } from "@playwright/test";
import { placeTakeawayOrderViaApi, signInCustomerViaApi } from "./auth";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

async function deliverOrderViaAdminApi(
  request: import("@playwright/test").APIRequestContext,
  orderNumber: string,
) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: {
      username: process.env.E2E_ADMIN_USERNAME || "admin",
      password: process.env.E2E_ADMIN_PASSWORD || "admin123",
    },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const response = await request.get(`${API}/admin/order?page=0&size=50`, { headers });
  const orders = await response.json();
  const order = (orders.list as { id: number; number: string }[]).find(
    (item) => item.number === orderNumber,
  );
  expect(order).toBeTruthy();

  for (const status of ["ACCEPTED", "DELIVERED"]) {
    const update = await request.patch(`${API}/admin/order/${order!.id}/status`, {
      headers,
      data: { status },
    });
    expect(update.ok()).toBeTruthy();
  }
}

test("customer rates a delivered order, retries a failure, and sees the review after refresh", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const customer = await signInCustomerViaApi(page, request, API);
  const order = await placeTakeawayOrderViaApi(request, API, customer.token);
  await deliverOrderViaAdminApi(request, order.number);

  let failOnce = true;
  await page.route("**/api/customer/orders/**/rating", async (route) => {
    if (failOnce) {
      failOnce = false;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Review service unavailable" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/orders");
  await page.getByRole("button", { name: "Rate order" }).click();

  const dialog = page.getByRole("dialog", { name: "Rate order" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio")).toHaveCount(5);
  const dialogFitsViewport = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= window.innerWidth;
  });
  expect(dialogFitsViewport).toBeTruthy();

  const oneStar = dialog.getByRole("radio", { name: "1 star" });
  await oneStar.focus();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(dialog.getByRole("radio", { name: "5 stars" })).toBeChecked();
  await dialog.getByPlaceholder("Tell us about your order").fill("Fresh and delicious");
  await dialog.getByRole("button", { name: "Submit review" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Review service unavailable");
  await expect(dialog.getByPlaceholder("Tell us about your order")).toHaveValue("Fresh and delicious");
  await dialog.getByRole("button", { name: "Submit review" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Fresh and delicious")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Fresh and delicious")).toBeVisible();

  const publicTrackingResponse = await request.get(`${API}/api/order/number/${order.number}`);
  expect(publicTrackingResponse.ok()).toBeTruthy();
  const publicTrackingOrder = await publicTrackingResponse.json();
  expect(publicTrackingOrder.review).toBeNull();

  await page.locator(`a[href="/tracking/${order.number}"]`).click();
  await expect(page.getByText("Customer review")).toBeVisible();
  await expect(page.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
  await expect(page.getByText("Fresh and delicious")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBeFalsy();
});

test("undelivered order has no rating option and server rejects a direct attempt", async ({
  page,
  request,
}) => {
  const customer = await signInCustomerViaApi(page, request, API);
  const order = await placeTakeawayOrderViaApi(request, API, customer.token);

  await page.goto("/orders");
  await expect(page.getByRole("button", { name: "Rate order" })).toHaveCount(0);

  const response = await request.post(`${API}/api/customer/orders/${order.number}/rating`, {
    headers: { Authorization: `Bearer ${customer.token}` },
    data: { rating: 5 },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toBe("Only delivered orders can be reviewed.");
});

test.describe("Order ratings on touch screens", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("star choices can be selected by touch", async ({ page, request }) => {
    const customer = await signInCustomerViaApi(page, request, API);
    const order = await placeTakeawayOrderViaApi(request, API, customer.token);
    await deliverOrderViaAdminApi(request, order.number);

    await page.goto("/orders");
    await page.getByRole("button", { name: "Rate order" }).tap();
    const dialog = page.getByRole("dialog", { name: "Rate order" });
    const fourStars = dialog.getByRole("radio", { name: "4 stars" });
    await fourStars.locator("xpath=..").tap();
    await expect(fourStars).toBeChecked();
  });
});
