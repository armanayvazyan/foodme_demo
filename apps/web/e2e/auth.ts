import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function createAccountAtCheckout(
  page: Page,
  name = "Casey Delivery",
) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e-${suffix}@example.com`;
  const password = "secret123";

  await page.getByRole("tab", { name: "Create account" }).click();
  const form = page.getByRole("form", { name: "Create account" });
  await form.getByLabel("Full name").fill(name);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Phone").fill("+37493333444");
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(new RegExp(`Signed in as ${name}`))).toBeVisible();

  return { email, password, name };
}

/**
 * Signs an existing customer in through the storefront login form and waits
 * for the Orders page. Use with `registerCustomerViaApi` (password "secret123").
 */
export async function signInViaUi(page: Page, email: string, password = "secret123") {
  await page.goto("/login?next=/orders");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your orders" })).toBeVisible();
}

/**
 * Places a cash takeaway order (1 × the first dish of the first active chef) for
 * the customer behind `token`. Returns the order's number, id, total and status.
 */
export async function placeOrderViaApi(
  request: APIRequestContext,
  apiBase: string,
  token: string,
) {
  const chefs = await (await request.get(`${apiBase}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  expect(chef).toBeTruthy();
  const detail = await (await request.get(`${apiBase}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  expect(dish).toBeTruthy();

  const createRes = await request.post(`${apiBase}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "E2E Customer",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "e2e-receiver@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      createOrderDishes: [{ dishId: dish.id, quantity: 1 }],
    },
  });
  expect(createRes.ok()).toBeTruthy();
  const created = await createRes.json();
  expect(created.status).toBe("NEW");

  // The create response has no id; the admin status endpoint needs it.
  const fullRes = await request.get(`${apiBase}/api/order/number/${created.number}`);
  expect(fullRes.ok()).toBeTruthy();
  const full = await fullRes.json();
  return {
    number: full.number as string,
    id: full.id as number,
    totalPrice: full.totalPrice as number,
    status: full.status as string,
  };
}

export async function registerCustomerViaApi(
  request: APIRequestContext,
  apiBase: string,
) {
  const email = `api-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await request.post(`${apiBase}/api/auth/register`, {
    data: {
      fullName: "E2E Customer",
      email,
      phoneNumber: "+37490000000",
      password: "secret123",
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { token: body.token as string, email };
}
