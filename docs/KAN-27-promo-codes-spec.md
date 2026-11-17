# KAN-27 promo codes: ticket export

Word-for-word export of the Jira descriptions of KAN-27 (Feature) and its subtasks KAN-28 and KAN-29, taken on 2026-11-17 from `https://foodme-armanayvazyan.atlassian.net`. Nothing is added, merged or reworded. This file is the readable source for the functional-testing run `agentic-workflows/functional-testing/runs/KAN-27/`.

---

# KAN-27: Apply a promo code at checkout

## Why

Marketing wants to run simple percentage promotions. Today there is no way for a customer to get a discount at checkout.

## User story

As a customer, I want to apply a promo code at checkout so that I pay less.

## What success looks like

1. On the checkout page, the customer can enter a promo code and press **Apply**.
2. A valid code reduces the subtotal by the code's percentage. The discount and the new total are shown before the order is placed.
3. A code works only if the subtotal is at least the code's minimum order amount. Otherwise the page shows "Add {missing amount} AMD more to use this code".
4. An expired code shows "This code has expired".
5. An unknown code shows "Code not found".
6. One code per order. Applying a second code replaces the first.
7. The customer can remove the applied code, and the total goes back to the original.

## Launch codes

| Code | Discount | Minimum order | Status |
| --- | --- | --- | --- |
| SAVE10 | 10% | 3,000 AMD | valid |
| TREAT15 | 15% | 8,000 AMD | valid |
| OLD15 | 15% | none | expired |

## Not in this release

* Free-delivery codes
* Chef-specific codes
* First-order-only codes

## Breakdown

1. Backend: promo validation and discount calculation
2. Checkout UI: promo field, messages, remove link

---

# KAN-28: Backend: promo validation and discount calculation

## Depends on

None

## User story

As a customer, I can have my promo code checked and priced by the server so that the discount I see at checkout is the discount I get on my order.

## Experience

* The checkout page sends the code, the chef, the cart subtotal and the delivery method, and gets back whether the code applies, the discount, the delivery fee and the new total.
* A code is rejected with a clear reason: not found, expired, or the order is below the code's minimum (with the missing amount).
* The discount is calculated on the order total including the delivery fee.
* When the order is placed with a code, the server checks the code again and saves the code and the discount on the order.
* The launch codes (SAVE10, TREAT15, OLD15) are added by a database migration.

## Not in scope

* Free-delivery, chef-specific and first-order-only codes.
* Admin screens for managing codes.

## Done when

* An automated test covers: applying a valid code, a code below its minimum, an expired code, an unknown code, and placing an order with a code.
* All automated checks pass.

---

# KAN-29: Checkout UI: promo field, messages, remove link

## Depends on

Backend: promo validation and discount calculation (sibling subtask of KAN-27)

## User story

As a customer, I can type a promo code on the checkout page, see what it saves me, and remove it again.

## Experience

* The order summary on **Checkout** has a **Promo code** field and an **Apply** button.
* When a code applies, the summary shows a discount line with the code and the amount, and the **Total** is updated before the order is placed.
* When a code doesn't apply, the field shows one of: "Add {missing amount} AMD more to use this code", "This code has expired", "Code not found".
* Applying another code replaces the one that is applied.
* A **Remove promo code** button takes the code off, and the total goes back to the original.
* All text goes through translations. No test ids: the field has a visible label and the buttons have accessible names.

## Not in scope

* Remembering a code across sessions or after the cart is cleared.
* The back office.

## Done when

* An automated test covers: apply a valid code, see the discount and new total, replace it with another code, remove it.
* Works on mobile and desktop.
* All automated checks pass.

---

# Test environment data (not from the tickets)

Read from the SUT's public API on 2026-11-17 (`GET /api/chef/active`, `GET /api/dish/17/active`); used by the test plan and the test cases.

* Chef Verona (id 17): delivery fee 500 AMD, free delivery from 5,000 AMD, delivery methods Delivery and Takeaway.
* Dishes: Rice 1,000 AMD; Mushroom soup 1,950 AMD; Quiche with vegetables 1,100 AMD; Bento cake 5,000 AMD.
