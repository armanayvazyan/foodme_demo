> Applies to: `apps/backend/**`

# Backend (Spring Boot) rules

- Keep controllers thin: validate input, call one service method, return a DTO.
  Business logic belongs in `service/`.
- Errors: throw `BadRequestException` (400) or `NotFoundException` (404).
  Do not build error responses by hand in controllers.
- Endpoint paths come from `utils/ControllerUtil` constants; add a constant
  rather than hard-coding a new `/api/...` string.
- Money is `double` today. Never cast to `int` when summing prices — that is
  exactly the kind of bug the course plants (see `FM-BUG-01`).
- Wrap writes in `@Transactional`; reads in `@Transactional(readOnly = true)`.
- Schema changes go in a **new** `db/migration/V<n>__<name>.sql`. Never edit
  V1–V3. Tests run with Flyway off and `ddl-auto=create-drop`, so a migration
  is not exercised by `./gradlew test` — say so when you add one.
- Tests: `@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`,
  hitting real endpoints through `MockMvc`. Register a fresh customer with a
  UUID email per test; never depend on test order for new tests.
- Verify with `./gradlew build` from `apps/backend`.
