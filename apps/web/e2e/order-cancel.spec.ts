import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

// TEST-9: customers can cancel an order from My Orders and Tracking while it is still "Received".
// Needs the backend on :8081 with seeded data. Orders are set up through the API, and the
// customer is signed in by seeding the same localStorage entry the app writes after login.

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const AUTH_STORAGE_KEY = "foodme.customer.auth";
// The backend adds 200–1500 ms of simulated latency per request, and a cancel triggers a
// mutation plus refetches, so assertions that follow an action get extra room.
const AFTER_ACTION = { timeout: 15_000 };

type Customer = { token: string; auth: unknown };
type PlacedOrder = { number: string; id: number };

async function registerCustomer(request: APIRequestContext): Promise<Customer> {
  const res = await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: "Cancel E2E",
      email: `cancel-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      phoneNumber: "+37490000000",
      password: "secret123",
    },
  });
  expect(res.ok()).toBeTruthy();
  const auth = await res.json();
  return { token: auth.token as string, auth };
}

async function placeOrder(
  request: APIRequestContext,
  token: string,
): Promise<PlacedOrder> {
  const chefs = await (
    await request.get(`${API}/api/chef/active?page=0&size=12`)
  ).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Cancel E2E",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "cancel-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: detail.dishes[0].id, quantity: 1 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  const { number } = await res.json();
  // The create response has no id; the customer's order list does (needed for the admin API).
  const mine = await (
    await request.get(`${API}/api/customer/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const order = mine.list.find((o: { number: string }) => o.number === number);
  expect(order).toBeTruthy();
  return { number, id: order.id as number };
}

async function acceptAsAdmin(request: APIRequestContext, orderId: number) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const res = await request.patch(`${API}/admin/order/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: "ACCEPTED" },
  });
  expect(res.ok()).toBeTruthy();
}

async function signIn(page: Page, customer: Customer) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [AUTH_STORAGE_KEY, JSON.stringify(customer.auth)] as const,
  );
}

const cancelButton = (page: Page) =>
  page.getByRole("button", { name: "Cancel order" });

test.describe("order cancellation", () => {
  test("cancel a received order from My Orders", async ({ page, request }) => {
    const customer = await registerCustomer(request);
    const order = await placeOrder(request, customer.token);
    await signIn(page, customer);

    await page.goto("/orders");
    const row = page.getByRole("listitem").filter({ hasText: order.number });
    await expect(row.getByText("Received")).toBeVisible();

    await row.getByRole("button", { name: "Cancel order" }).click();

    await expect(row.getByText("Cancelled")).toBeVisible(AFTER_ACTION);
    await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(
      0,
    );
  });

  test("cancel a received order from Tracking, and My Orders shows it", async ({
    page,
    request,
  }) => {
    const customer = await registerCustomer(request);
    const order = await placeOrder(request, customer.token);
    await signIn(page, customer);

    await page.goto(`/tracking/${order.number}`);
    await expect(page.getByText("Order received")).toBeVisible();

    await cancelButton(page).click();

    await expect(page.getByText("Order cancelled")).toBeVisible(AFTER_ACTION);
    await expect(
      page.getByText(
        "You cancelled this order before the kitchen accepted it.",
      ),
    ).toBeVisible();
    await expect(cancelButton(page)).toHaveCount(0);

    await page.getByRole("link", { name: "All orders" }).click();
    const row = page.getByRole("listitem").filter({ hasText: order.number });
    await expect(row.getByText("Cancelled")).toBeVisible(AFTER_ACTION);
  });

  test("no Cancel button once the kitchen has accepted the order", async ({
    page,
    request,
  }) => {
    const customer = await registerCustomer(request);
    const order = await placeOrder(request, customer.token);
    await acceptAsAdmin(request, order.id);
    await signIn(page, customer);

    await page.goto("/orders");
    const row = page.getByRole("listitem").filter({ hasText: order.number });
    await expect(row.getByText("Preparing")).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel order" })).toHaveCount(
      0,
    );

    await page.goto(`/tracking/${order.number}`);
    await expect(page.getByText("Preparing your order")).toBeVisible();
    await expect(cancelButton(page)).toHaveCount(0);
  });

  test("a cancel refused because the kitchen just accepted shows why", async ({
    page,
    request,
  }) => {
    const customer = await registerCustomer(request);
    const order = await placeOrder(request, customer.token);
    await signIn(page, customer);

    await page.goto(`/tracking/${order.number}`);
    await expect(cancelButton(page)).toBeVisible();

    // The kitchen accepts while the customer still sees "Order received".
    await acceptAsAdmin(request, order.id);
    await cancelButton(page).click();

    await expect(page.getByRole("alert")).toHaveText(
      "This order can no longer be cancelled.",
      AFTER_ACTION,
    );
    await expect(page.getByText("Preparing your order")).toBeVisible(
      AFTER_ACTION,
    );
    await expect(cancelButton(page)).toHaveCount(0);
  });
});
