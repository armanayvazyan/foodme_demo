import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { placeOrderViaApi, registerCustomerViaApi, signInViaUi } from "./auth";

// FOODQA-2: a customer cancels their own order while it is NEW ("Received").
// API rules, the "final status" rule and the cancel/accept race are covered by
// the backend's OrderCancellationControllerTest; these tests cover the storefront.
// Every test registers its own customer and places its own order.

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";

async function setStatusAsAdmin(
  request: APIRequestContext,
  orderId: number,
  status: "ACCEPTED" | "DELIVERED" | "REJECTED",
  rejectReason: string | null = null,
) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const res = await request.patch(`${API}/admin/order/${orderId}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status, rejectReason },
  });
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).status).toBe(status);
}

async function persistedStatus(request: APIRequestContext, number: string) {
  const res = await request.get(`${API}/api/order/number/${number}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).status as string;
}

async function customerWithOrder(request: APIRequestContext) {
  const customer = await registerCustomerViaApi(request, API);
  const order = await placeOrderViaApi(request, API, customer.token);
  return { customer, order };
}

function orderRow(page: Page, number: string) {
  return page.getByRole("listitem").filter({ hasText: number });
}

function cancelButton(page: Page, number: string) {
  return page.getByRole("button", { name: `Cancel order ${number}`, exact: true });
}

function cancelDialog(page: Page) {
  return page.getByRole("dialog", { name: "Cancel this order?" });
}

test.describe("Order cancellation (storefront)", () => {
  // W1
  test("customer cancels a Received order and it shows as Cancelled", async ({ page, request }) => {
    const { customer, order } = await customerWithOrder(request);
    await signInViaUi(page, customer.email);

    const row = orderRow(page, order.number);
    await expect(row.getByText("Received", { exact: true })).toBeVisible();

    await cancelButton(page, order.number).click();
    const dialog = cancelDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("This can't be undone.")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel order", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(cancelButton(page, order.number)).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await persistedStatus(request, order.number)).toBe("CANCELLED");

    await page.reload();
    await expect(orderRow(page, order.number).getByText("Cancelled", { exact: true })).toBeVisible();
    await expect(cancelButton(page, order.number)).toHaveCount(0);
  });

  // W2
  test("Keep order closes the dialog and leaves the order Received", async ({ page, request }) => {
    const { customer, order } = await customerWithOrder(request);
    await signInViaUi(page, customer.email);

    await cancelButton(page, order.number).click();
    const dialog = cancelDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep order", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(orderRow(page, order.number).getByText("Received", { exact: true })).toBeVisible();
    await expect(cancelButton(page, order.number)).toBeVisible();
    expect(await persistedStatus(request, order.number)).toBe("NEW");
  });

  // W3
  test("an accepted (Preparing) order has no Cancel button", async ({ page, request }) => {
    const { customer, order } = await customerWithOrder(request);
    await setStatusAsAdmin(request, order.id, "ACCEPTED");
    await signInViaUi(page, customer.email);

    await expect(orderRow(page, order.number).getByText("Preparing", { exact: true })).toBeVisible();
    await expect(cancelButton(page, order.number)).toHaveCount(0);
  });

  // W4
  const finishedCases = [
    {
      label: "Delivered",
      setUp: async (request: APIRequestContext, id: number) => {
        await setStatusAsAdmin(request, id, "ACCEPTED");
        await setStatusAsAdmin(request, id, "DELIVERED");
      },
    },
    {
      label: "Declined",
      setUp: async (request: APIRequestContext, id: number) => {
        await setStatusAsAdmin(request, id, "REJECTED", "Kitchen closed");
      },
    },
  ];
  for (const { label, setUp } of finishedCases) {
    test(`a ${label} order has no Cancel button`, async ({ page, request }) => {
      const { customer, order } = await customerWithOrder(request);
      await setUp(request, order.id);
      await signInViaUi(page, customer.email);

      await expect(orderRow(page, order.number).getByText(label, { exact: true })).toBeVisible();
      await expect(cancelButton(page, order.number)).toHaveCount(0);
    });
  }

  // W5
  test("kitchen accepts while the dialog is open: cancel is refused and the order shows Preparing", async ({
    page,
    request,
  }) => {
    const { customer, order } = await customerWithOrder(request);
    await signInViaUi(page, customer.email);

    await cancelButton(page, order.number).click();
    const dialog = cancelDialog(page);
    await expect(dialog).toBeVisible();

    // The kitchen accepts before the customer confirms (the page still shows Received).
    await setStatusAsAdmin(request, order.id, "ACCEPTED");
    await dialog.getByRole("button", { name: "Cancel order", exact: true }).click();

    await expect(page.getByRole("alert")).toHaveText("Cannot cancel order in status ACCEPTED");
    await expect(dialog).toBeHidden();
    await expect(orderRow(page, order.number).getByText("Preparing", { exact: true })).toBeVisible();
    await expect(cancelButton(page, order.number)).toHaveCount(0);
    expect(await persistedStatus(request, order.number)).toBe("ACCEPTED");
  });

  // W6
  test("tracking page shows a cancelled order as cancelled, without progress steps", async ({
    page,
    request,
  }) => {
    const { customer, order } = await customerWithOrder(request);
    const cancelRes = await request.post(`${API}/api/customer/orders/${order.number}/cancel`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });
    expect(cancelRes.ok()).toBeTruthy();
    expect((await cancelRes.json()).status).toBe("CANCELLED");

    await page.goto(`/tracking/${order.number}`);
    await expect(page.getByRole("heading", { name: `Order ${order.number}` })).toBeVisible();
    await expect(page.getByText("Order cancelled", { exact: true })).toBeVisible();
    await expect(
      page.getByText("You cancelled this order before the kitchen accepted it.", { exact: true }),
    ).toBeVisible();
    for (const step of ["Received", "Preparing", "Delivered"]) {
      await expect(page.getByText(step, { exact: true })).toHaveCount(0);
    }
  });
});
