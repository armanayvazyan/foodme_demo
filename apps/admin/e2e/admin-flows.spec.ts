import { test, expect, type Page } from "@playwright/test";

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: "FoodMe Admin" })).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible({ timeout: 15000 });
}

async function createOrderViaApi(request: import("@playwright/test").APIRequestContext) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  const email = `admin-e2e-${Date.now()}@example.com`;
  const registerRes = await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: "Admin E2E",
      email,
      phoneNumber: "+37495555666",
      password: "secret123",
    },
  });
  expect(registerRes.ok()).toBeTruthy();
  const { token } = await registerRes.json();
  const createRes = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Admin E2E",
      receiverPhoneNumber: "+37495555666",
      receiverEmail: "admin-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "admin e2e order",
      createOrderDishes: [{ dishId: dish.id, quantity: 1 }],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  // `token` is the ordering customer's, so a test can act as them (e.g. cancel the order).
  return { ...(await createRes.json()), token };
}

async function cancelAsCustomer(
  request: import("@playwright/test").APIRequestContext,
  order: { number: string; token: string },
) {
  const res = await request.post(`${API}/api/customer/orders/${order.number}/cancel`, {
    headers: { Authorization: `Bearer ${order.token}` },
  });
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).status).toBe("CANCELLED");
}

// Same formatting as the dashboard's currency() helper.
const amd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "AMD", maximumFractionDigits: 0 }).format(value);

test.describe("Admin auth", () => {
  test("rejects bad password", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("logs in with seeded credentials", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole("menuitem", { name: "Chefs" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Dishes" })).toBeVisible();
  });
});

test.describe("Admin resources", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("orders list shows rows after API order", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByText(order.number)).toBeVisible({ timeout: 15000 });
  });

  test("order show + mark ACCEPTED", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.getByText(order.number).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);
    // Both the app-bar title and the page heading render "Order FM-…"; target
    // the h5 page heading to keep the locator strict-mode safe.
    await expect(
      page.getByRole("heading", { name: `Order ${order.number}`, level: 5 }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Mark as ACCEPTED" }).click();
    await expect(page.getByText("Order status updated")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("ACCEPTED").first()).toBeVisible();
  });

  test("chefs list loads and opens edit", async ({ page }) => {
    await page.goto("/#/chefs");
    await expect(page.getByText("No Chefs found")).toHaveCount(0, { timeout: 15000 });
    await expect(
      page.getByText(/Alans Kitchen|Italiano Margarino|Chef Verona|Argentinean|Armenian Traditional|Sakura Kitchen/i).first(),
    ).toBeVisible({ timeout: 15000 });
    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/#\/chefs\/\d+/);
  });

  test("dishes list loads and opens edit", async ({ page }) => {
    await page.goto("/#/dishes");
    await expect(page.getByText("No Dishes found")).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });
    await page.locator("table tbody tr").first().click();
    await expect(page).toHaveURL(/#\/dishes\/\d+/);
  });

  // TEST-10: the admin panel understands orders the customer cancelled.
  test("cancelled order shows CANCELLED with no status actions", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelAsCustomer(request, order);

    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    await page.getByText(order.number).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);
    await expect(
      page.getByRole("heading", { name: `Order ${order.number}`, level: 5 }),
    ).toBeVisible();

    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByText("Change status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mark as/ })).toHaveCount(0);
  });

  test("orders list filters by CANCELLED", async ({ page, request }) => {
    const order = await createOrderViaApi(request);
    await cancelAsCustomer(request, order);

    await page.goto("/#/orders");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "CANCELLED", exact: true }).click();

    const rows = page.locator("table tbody tr");
    await expect(rows.filter({ hasText: order.number })).toBeVisible({ timeout: 15000 });
    // Every row on the filtered page is a cancelled order.
    await expect(rows.filter({ hasNotText: "CANCELLED" })).toHaveCount(0);
  });

  test("dashboard revenue excludes cancelled and rejected orders", async ({ page }) => {
    // Stub the order list so the sum is deterministic whatever else is in the database.
    const stubOrders = [
      { id: 900001, number: "FM-STUB-NEW", status: "NEW", totalPrice: 1000 },
      { id: 900002, number: "FM-STUB-CANCELLED", status: "CANCELLED", totalPrice: 5000 },
      { id: 900003, number: "FM-STUB-REJECTED", status: "REJECTED", totalPrice: 7000 },
    ].map((o) => ({ ...o, chefName: "Stub Chef", receiverName: "Stub", createdAt: "2026-11-10T12:00:00" }));
    await page.route(/\/admin\/order\?/, (route) =>
      route.fulfill({ json: { list: stubOrders, count: stubOrders.length } }),
    );

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    const revenueCard = page.locator(".MuiCard-root").filter({ hasText: "Recent revenue" });
    await expect(revenueCard).toContainText(amd(1000), { timeout: 15000 });
    await expect(revenueCard).not.toContainText(amd(6000)); // NEW + CANCELLED
    await expect(revenueCard).not.toContainText(amd(13000)); // all three
  });

  test("sidebar navigates between resources", async ({ page }) => {
    await page.goto("/#/orders");
    await page.getByRole("menuitem", { name: "Chefs" }).click();
    await expect(page).toHaveURL(/#\/chefs/);
    await page.getByRole("menuitem", { name: "Dishes" }).click();
    await expect(page).toHaveURL(/#\/dishes/);
    await page.getByRole("menuitem", { name: "Orders" }).click();
    await expect(page).toHaveURL(/#\/orders/);
  });
});
