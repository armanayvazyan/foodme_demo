---
paths:
  - "apps/backend/**"
---

# Backend rules (`apps/backend`)

Spring Boot 3.3, Java 17, Gradle, Lombok. On Windows use `.\gradlew.bat`.

## Commands
```
./gradlew bootRun    # needs Postgres on localhost:5432, db/user/password = foodme; serves on :8081
./gradlew bootJar
```

## Layout
Package `am.foodme.backend`: `controller/{api,admin}` → `service` → `repository` → `model`. Data goes in and out through `dto`. Errors go through `exceptionHandler/GlobalExceptionHandler`, which handles `NotFoundException` and `BadRequestException`. Path constants are in `utils/ControllerUtil`.

## URL spaces and security
- `/api/**`: public storefront API. `/api/customer/**` and `POST /api/order` require role CUSTOMER. `/api/auth/**` handles customer login and register.
- `/admin/**`: admin REST API, JWT-protected. Exceptions: `/admin/auth/login`, and `GET /admin/dish/**` is public.
- Security is stateless JWT (`security/JwtService`, `JwtAuthenticationFilter`, `SecurityConfig`).
- `SpaWebConfig` serves the bundled SPAs. Any new top-level backend path prefix must be added to its exclusion list, or unknown routes under it will get the SPA `index.html` instead of a 404.

## Images
Images are stored in Postgres and served at `/api/images/**`. URLs are stored relative and made absolute per request by `config/ImageUrlResponseAdvice`. If you add a DTO that carries image URLs, add it to that advice.

## Intentional demo behavior (leave in place)
- `SimulatedLatencyConfig` adds a 200–1500 ms random delay to `/api/**` and `/admin/**`, except `/api/images/**`.
- `observability/FlakyHeartbeatJob` sometimes fails on purpose.
- `DebugController` `/boom` throws on purpose for the error tracker.
- `// FM-BUG-NN` markers (in `OrderService`, `ChefService`, `CreateOrderDishDto`, `OrderDto`) are planted bugs. Fix one only when a ticket asks for it.

## Observability
- Exposes `/actuator/health` and `/actuator/prometheus`.
- Writes JSON logs. They are pushed to Loki only when `LOKI_PUSH_URL` is set (`logback-spring.xml`).
- `HttpLoggingFilter` logs `/api/**` and `/admin/**` traffic with secrets redacted. Any new sensitive field must be added to its redaction list.
- Errors go to Sentry/GlitchTip through `SENTRY_DSN`.
