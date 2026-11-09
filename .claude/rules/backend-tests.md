---
paths: apps/backend/src/test/**
---
- Unit tests: plain JUnit 5 + Mockito, no Spring context, file name <Class>UnitTest.java
- Integration tests: @SpringBootTest + @AutoConfigureMockMvc + @ActiveProfiles("test"), like OrderControllerTest.
- Never use Thread.sleep. Create unique test data (random email) so tests do not depend on each other.
- Use @DisplayName("FM-<ticket>-<nn>: <what> when <condition>") and a comment "AC: <number>".
