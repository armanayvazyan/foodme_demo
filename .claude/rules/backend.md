---
paths:
  - "apps/backend/**"
---

# Backend (Spring Boot)

Spring Boot 3.3, Java 17, Gradle, JPA, JWT auth (`com.auth0:java-jwt`), springdoc, Lombok.

## Commands (from `apps/backend`)

```bash
./gradlew bootRun     # port 8081; needs Postgres on localhost:5432 (db/user/pass: foodme)
./gradlew bootJar
```

`.env.example` mentions `infra/docker-compose.yml`, but that file is not in the repo. To run locally, start a Postgres instance yourself.

## Structure

- `controller/api` holds the public and customer endpoints. `controller/admin` holds the back-office endpoints.
- The layers are `service`, `repository` (including the custom `DishSearchRepositoryImpl`) and `model` (JPA entities).
- Controllers return `dto/*` and never entities.
- Errors go through `exceptionHandler/GlobalExceptionHandler`: `BadRequestException` / `NotFoundException` become `ErrorResponseDto`.

## Security (`security/SecurityConfig.java`)

- `/api/auth/**`: customer register and login.
- `/api/customer/**` and `POST /api/order`: require `ROLE_CUSTOMER`.
- All other `/api/**` routes are public: chefs, dishes, orders by number, `/api/images/**`.
- `/admin/auth/login`: admin login. Other `/admin/**` routes need an admin JWT, except `GET /admin/dish/**`.
- `/actuator/**` and Swagger UI (`/swagger-ui.html`, `/v3/api-docs`) are public.

## Things that look odd but are intentional

- **Frozen API contract.** Don't rename paths, DTO fields or JSON names. The SPAs, e2e tests and course material depend on them.
- **Planted defects.** `// FM-BUG-nn` markers appear in `OrderService`, `ChefService`, `OrderDto` and `CreateOrderDishDto`. Leave them alone unless asked.
- **Simulated latency.** `SimulatedLatencyConfig` adds 200 ms+ to `/api/**` and `/admin/**`. It skips `/actuator/**`, static assets and `/api/images/**`.
- **Flaky heartbeat.** `FlakyHeartbeatJob` (profile `!test`) reports a fake error to Sentry about one run in ten.
- **Request logging.** `HttpLoggingFilter` logs request and response bodies with secrets redacted. Turn it off with `HTTP_LOGGING_ENABLED=false`.
- **SPA serving.** `SpaWebConfig` serves the bundled SPAs: the storefront at `/` and admin at `/backoffice`. Paths without a file extension fall back to the SPA `index.html`. Admin can't sit at `/admin`, because that is the REST API.
- **Images.** `ImageUrlResponseAdvice` rewrites image URLs in responses. Images are stored in Postgres (see the db rule).

## Config and deploy

- **Render's `DATABASE_URL`.** `DatabaseUrlEnvironmentPostProcessor` converts `DATABASE_URL=postgresql://…` into JDBC settings. It is registered in `META-INF/spring.factories`. Removing that registration breaks the Render deploy.
- **Logging.** Logs are JSON (logstash encoder). `logback-spring.xml` enables the Loki appender only when `LOKI_PUSH_URL` is set, through a janino `<if>`; keep the janino dependency. The URL must be the monitoring service's public `https://…onrender.com/loki/api/v1/push`, because free Render services can't receive private-network traffic.
- **Sentry/GlitchTip.** Configured through `SENTRY_DSN`. If it is empty, Sentry is off.
- **Free-tier tuning.** Render's free tier has 512 MB and 0.1 CPU. Keep the JVM flags in the Dockerfile (C1 only, SerialGC, `MaxRAMPercentage=60`, `-Xss512k`) and `server.tomcat.threads.max=32`. Without them startup misses Render's health-check window (`/actuator/health`).
- **Image build.** The production image is built from the repo root with `docker build -f apps/backend/Dockerfile -t foodme .`. It also builds both SPAs.
