import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// FOODQA-2: how the back office shows customer-cancelled orders, and that they
// don't count as revenue. Each test creates and cancels its own order through
// the API. Helpers stay local, as in admin-flows.spec.ts: this suite has its own
// @playwright/test install, so it can't import apps/web/e2e/auth.ts.

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const STATUSES = ["NEW", "ACCEPTED", "DELIVERED", "REJECTED", "CANCELLED"];

async function loginAsAdmin(page: Page) {
  await page.goto("/#/login");
  await expect(page.getByRole("heading", { name: "FoodMe Admin" })).toBeVisible();
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("menuitem", { name: "Orders" })).toBeVisible({ timeout: 15000 });
}

async function adminToken(request: APIRequestContext) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  return (await login.json()).token as string;
}

/** Registers a customer, places a NEW order for them and cancels it as that customer. */
async function createCancelledOrder(request: APIRequestContext) {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  expect(dish).toBeTruthy();

  const email = `admin-cancel-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const registerRes = await request.post(`${API}/api/auth/register`, {
    data: { fullName: "Admin Cancel E2E", email, phoneNumber: "+37495555666", password: "secret123" },
  });
  expect(registerRes.ok()).toBeTruthy();
  const { token } = await registerRes.json();

  const createRes = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Admin Cancel E2E",
      receiverPhoneNumber: "+37495555666",
      receiverEmail: "admin-cancel-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: dish.id, quantity: 1 }],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const { number } = await createRes.json();

  const cancelRes = await request.post(`${API}/api/customer/orders/${number}/cancel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(cancelRes.ok()).toBeTruthy();
  const cancelled = await cancelRes.json();
  expect(cancelled.status).toBe("CANCELLED");
  expect(cancelled.totalPrice).toBeGreaterThan(0);
  return { number: cancelled.number as string, id: cancelled.id as number, totalPrice: cancelled.totalPrice as number };
}

test.describe("Order cancellation (back office)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // A1
  test("cancelled order shows CANCELLED in the list and on its page, with no status actions", async ({
    page,
    request,
  }) => {
    const order = await createCancelledOrder(request);

    await page.goto("/#/orders");
    await page.getByRole("button", { name: "Refresh" }).click();
    const row = page.getByRole("row").filter({ hasText: order.number });
    await expect(row.getByText("CANCELLED", { exact: true })).toBeVisible({ timeout: 15000 });

    await row.getByText(order.number, { exact: true }).click();
    await expect(page).toHaveURL(/#\/orders\/\d+\/show/);
    await expect(
      page.getByRole("heading", { name: `Order ${order.number}`, level: 5 }),
    ).toBeVisible();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    await expect(page.getByText("Change status", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mark as / })).toHaveCount(0);
  });

  // A2
  test("orders can be filtered by CANCELLED", async ({ page, request }) => {
    const order = await createCancelledOrder(request);

    await page.goto("/#/orders");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "CANCELLED", exact: true }).click();

    const table = page.getByRole("table");
    await expect(
      table.getByRole("row").filter({ hasText: order.number }).getByText("CANCELLED", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    for (const other of STATUSES.filter((s) => s !== "CANCELLED")) {
      await expect(table.getByText(other, { exact: true })).toHaveCount(0);
    }
  });

  // A3
  test("Recent revenue excludes cancelled and declined orders", async ({ page, request }) => {
    const order = await createCancelledOrder(request);
    const token = await adminToken(request);

    // The dashboard sums the 100 most recent orders. Recompute that sum from the
    // same page of the admin API; retry the whole comparison if another test
    // places an order between the two reads.
    await expect(async () => {
      const res = await request.get(`${API}/admin/order?page=0&size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok()).toBeTruthy();
      const { list } = (await res.json()) as { list: { number: string; status: string; totalPrice: number }[] };
      expect(list.some((o) => o.number === order.number && o.status === "CANCELLED")).toBe(true);
      const expected = Math.round(
        list
          .filter((o) => o.status !== "REJECTED" && o.status !== "CANCELLED")
          .reduce((sum, o) => sum + (o.totalPrice ?? 0), 0),
      );

      await page.goto("/#/");
      const card = page.getByText("Recent revenue", { exact: true }).locator("..");
      await expect(card).toHaveText(/Recent revenue.*\d/, { timeout: 15000 });
      const shown = Number((await card.innerText()).replace("Recent revenue", "").replace(/\D/g, ""));
      expect(shown).toBe(expected);
    }).toPass({ timeout: 60000 });
  });
});
