---
name: write-integration-tests
description: Write backend integration tests for FoodMe that boot the real Spring context and call the API through MockMvc against in-memory H2 seed data — covering controllers, security/JWT, validation, error responses, and JPA queries. Use when the user asks for integration tests, API/controller/endpoint tests, auth tests, or repository/query tests.
---

# Write integration tests (backend)

Integration tests here start the **full Spring Boot context** with the `test` profile and go through HTTP via MockMvc. That covers security filters, validation, `GlobalExceptionHandler`, services, JPA and the database (H2 in PostgreSQL mode) together. This is the established style of the suite: `ChefControllerTest`, `DishControllerTest`, `CustomerAuthControllerTest`, `OrderControllerTest`.

`.claude/rules/testing-backend.md` loads automatically when you touch test files. It covers commands and test-profile details. This skill is the workflow.

## Step 0: Understand the endpoint

1. Read the controller (`controller/api/*` for the public/customer API, `controller/admin/*` for back office). Path constants are in `utils/ControllerUtil.java`.
2. Read the DTOs it accepts and returns, and their validation annotations.
3. Check `security/SecurityConfig.java` for the access rules:
   - `/api/auth/**` and most of `/api/**`: public
   - `/api/customer/**` and `POST /api/order`: `ROLE_CUSTOMER` (Bearer JWT)
   - `/admin/auth/login`: public. `GET /admin/dish/**`: public. Everything else under `/admin/**`: authenticated
4. Search for `FM-BUG-` in the code path (see "Planted bugs" below).
5. Look at `src/test/resources/data.sql` to see which rows exist. Chef 1 and 2 are ACTIVE, chef 3 is INACTIVE. Dish 4 is INACTIVE. The admin user is `admin`.

## What to cover per endpoint

- Happy path: status code **and** the key JSON fields (`jsonPath`)
- Auth: no token → 401, wrong role → 401/403, valid token → OK
- Validation: missing or invalid fields → 400 with the error `message` from `ErrorResponseDto`
- Not found: unknown id → 404
- Business rules: inactive chef/dish, payment type, delivery method, pagination edges (first page, last page, page past the end)
- Side effects: after a write, read it back through another endpoint (for example, create an order, then `GET /api/customer/orders`)

## Template

**Location:** `apps/backend/src/test/java/am/foodme/backend/<Name>ControllerTest.java`. Use the flat package, like the existing integration tests.

```java
package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ExampleControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    /** Registers a fresh customer and returns its JWT. Emails must be unique: H2 is shared across the context. */
    private String customerToken() throws Exception {
        String email = "it-" + UUID.randomUUID() + "@example.com";
        String body = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann", "email", email,
                                "phoneNumber", "+37491234567", "password", "secret123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("token").asText();
    }

    @Test
    void getChef_unknownId_returns404() throws Exception {
        mockMvc.perform(get("/api/chef/{id}", 9999))
                .andExpect(status().isNotFound());
    }
}
```

**Admin endpoints:** get a token from `POST /admin/auth/login` with the seeded admin (check `AdminLoginRequestDto` for field names; the password used by e2e is `admin123`). Then send `Authorization: Bearer <token>`. For tests that only check authorization rules, `@WithMockUser(roles = "ADMIN")` from `spring-security-test` also works.

## Rules that keep the suite stable

- **Shared state:** every test class that uses the same configuration reuses one Spring context and **one H2 database**. Data written in one test is visible to later tests, even in other classes. So:
  - Create your own data (a new customer, a new order) rather than mutating seed rows.
  - Never assert exact global counts or sequence values that other tests can change. Assert on the rows you created. (`OrderControllerTest`'s order-number test is the counter-example and is tagged `FM-FLAKE-02`.)
  - If you need ordering inside a class, use `@TestMethodOrder(OrderAnnotation)` + `@Order` and keep the numbers consistent with the existing ones.
- **Seed data:** if you need rows that don't exist, add them to `src/test/resources/data.sql` with explicit ids that don't collide. Check that the existing tests still pass afterwards.
- **No new context config:** avoid `@MockBean`, `@DirtiesContext` or extra properties unless they're really needed. Each one forces a fresh Spring context and slows the suite down.
- **Flyway is off in tests.** Hibernate builds the schema from the entities. These tests don't validate migrations. If the task is about a migration, tell the user.
- **Repository / query tests:** prefer going through the endpoint. Use `@DataJpaTest` + `@ActiveProfiles("test")` only for a complex custom query such as `DishSearchRepositoryImpl`. It still loads `data.sql`.

## Planted bugs (FM-BUG-NN)

Several bugs live exactly on these code paths (`OrderService`, `ChefService`, `OrderDto`, `CreateOrderDishDto`).
1. Assert the **intended** behavior.
2. If the test fails because of a planted bug, **don't modify production code** unless the task is to fix that bug. Report the failing test and the FM-BUG id.
3. Ask the user which they want: keep it failing, `@Disabled("FM-BUG-NN: …")`, or assert the current behavior with an explaining comment.

## Run and report

From `apps/backend` (on Windows use `.\gradlew.bat`):
```
./gradlew test --tests 'am.foodme.backend.ExampleControllerTest'
./gradlew test            # full suite: make sure you didn't break shared state
```
Run the whole suite after adding tests or seed rows, because shared H2 state can break other classes. Report the results faithfully, including any failures that come from planted bugs.
