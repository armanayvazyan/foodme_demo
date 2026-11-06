---
paths:
  - "apps/backend/**"
---
# Backend rules (Java / Gradle)

- Build and test with the Gradle wrapper: `./gradlew build` and `./gradlew test`, run from `apps/backend`.
- Don't change `build.gradle` dependencies unless the task requires it.
- Validate all request input and return clear error responses.
