---
name: api-smoke
description: Run a quick curl-based smoke test against a running FoodMe backend (local :8081 or a Render URL) covering health, catalogue, auth, delivery price and order creation. Use for "is the backend up", "smoke test the API", "check the deploy", or to reproduce a bug at API level.
---

# API smoke check

Base URL: `$API` — default `http://localhost:8081`; for Render use the service
URL. Free Render instances cold-start in ~1 minute: retry health before failing.

Run the steps in order, print a PASS/FAIL line per step, and stop at the first
hard failure. Use `jq` for JSON. Use a unique email per run.

```bash
API=${API:-http://localhost:8081}
EMAIL="smoke-$(date +%s)@example.com"

# 1. health → {"status":"UP"}
curl -sf "$API/actuator/health" | jq -e '.status=="UP"'

# 2. catalogue: active chefs (paged) and one chef's dishes
CHEF=$(curl -sf "$API/api/chef/active?page=0&size=12" | jq '.exploreChefResponseDtoList[0].id')
DISH=$(curl -sf "$API/api/chef/$CHEF" | jq '.dishes[0].id')

# 3. register → token
TOKEN=$(curl -sf -X POST "$API/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"fullName\":\"Smoke\",\"email\":\"$EMAIL\",\"phoneNumber\":\"+37491234567\",\"password\":\"secret123\"}" | jq -r .token)

# 4. delivery price (TAKEAWAY must be 0)
curl -sf -X POST "$API/api/order/delivery-price" -H 'Content-Type: application/json' \
  -d "{\"chefId\":$CHEF,\"subtotal\":1000,\"deliveryMethod\":\"TAKEAWAY\"}" | jq -e '.deliveryPrice==0'

# 5. create a TAKEAWAY cash order → number FM-...
NUMBER=$(curl -sf -X POST "$API/api/order" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"chefId\":$CHEF,\"paymentType\":\"CASH\",\"deliveryMethod\":\"TAKEAWAY\",\"receiverName\":\"Smoke\",\"receiverPhoneNumber\":\"+37491234567\",\"receiverEmail\":\"$EMAIL\",\"createOrderDishes\":[{\"dishId\":$DISH,\"quantity\":1}]}" | jq -r .number)

# 6. look it up
curl -sf "$API/api/order/number/$NUMBER" | jq -e '.status=="NEW"'

# 7. negative: non-CASH payment must be 400
curl -s -o /dev/null -w '%{http_code}' -X POST "$API/api/order" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"chefId\":$CHEF,\"paymentType\":\"CARD\",\"deliveryMethod\":\"TAKEAWAY\",\"createOrderDishes\":[]}"
```

If the field names have drifted, check the DTOs in
`apps/backend/src/main/java/am/foodme/backend/dto/` and the e2e helpers in
`apps/admin/e2e/admin-flows.spec.ts` rather than guessing.

Report as a table: step, PASS/FAIL, HTTP status, short note. Smoke orders are
real rows — mention that when running against a shared/deployed database, and
ask before running step 5 against production.
