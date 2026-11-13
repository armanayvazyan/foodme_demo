---
paths:
  - "apps/backend/**"
---

# Backend architecture

## Package hierarchy (`am.foodme.backend`)

```
controller/
├── api/          public + customer endpoints (Chef, Dish, Order, Customer, CustomerAuth, Image, Debug)
└── admin/        admin endpoints (AdminAuth, AdminChef, AdminDish, AdminOrder)
service/          business logic, one service per area (admin services prefixed Admin*), ImageSeedRunner
repository/       Spring Data JPA + custom DishSearchRepositoryImpl
model/            JPA entities (schema foodme)
dto/              request/response DTOs, the shared API contract
security/         SecurityConfig, JwtService, JwtAuthenticationFilter
config/           SpaWebConfig, ImageUrlResponseAdvice, DatabaseUrlEnvironmentPostProcessor, SimulatedLatencyConfig
observability/    HttpLoggingFilter, FlakyHeartbeatJob
exceptionHandler/ GlobalExceptionHandler, NotFoundException, BadRequestException
utils/            ControllerUtil (route prefix constants)
```

Resources: `db/migration/` (Flyway), `img-seed/` (seed images), `logback-spring.xml`, `META-INF/spring.factories`.

## Layering

`controller` → `service` → `repository` → `model`. Controllers take and return DTOs. Services map between entities and DTOs. Errors go through `GlobalExceptionHandler`.

## Security

Stateless JWT (auth0 java-jwt) with two roles.

- Customers log in via `/api/auth/**` and need `ROLE_CUSTOMER` for `/api/customer/**` and `POST /api/order`.
- Admins log in via `/admin/auth/login`, and every other `/admin/**` route needs the admin role.
- The rest of `/api/**` is public.
- CORS origins come from `FOODME_CORS_ALLOWED_ORIGINS` (default `*`).

## Data

- Flyway migrations own the schema. Hibernate runs with `ddl-auto=validate`. Tables live in the `foodme` schema.
- Images are stored in Postgres (`foodme.image`, V2) and served at `/api/images/**`. `ImageSeedRunner` loads `img-seed/` on first start. URLs are stored relative (`/api/images/...`), and `ImageUrlResponseAdvice` makes them absolute per request.
- `DatabaseUrlEnvironmentPostProcessor` turns Render/Neon `postgresql://` URLs into JDBC and adds `sslmode=require` unless one is present. It's registered in `META-INF/spring.factories`.

## Observability

- `/actuator/health` (Render health check) and `/actuator/prometheus`.
- JSON logs (logstash encoder), shipped to Loki only when `LOKI_PUSH_URL` is set. That check is a janino `<if>` in `logback-spring.xml`.
- Sentry turns on when `SENTRY_DSN` is set.
