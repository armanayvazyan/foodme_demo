---
name: write-test-cases
description: Write manual test cases for FoodMe from a Jira ticket, feature or bug fix and save them to Qase. Use when the user asks for test cases, test scenarios, a test checklist or coverage for a ticket. For automated test code, use the write-*-tests skills.
---

# Writing manual test cases

1. Read the ticket (Jira project SCRUM) and the code to learn the real rules: allowed statuses, who can act, error messages.
2. Take expected results from the ticket, not the code, because the code has planted bugs (`FM-BUG-NN`). If they disagree, tell the user. Don't name planted bugs in cases.
3. Search Qase for existing cases and propose updates rather than duplicates.
4. Cover what applies: happy path, invalid input, boundaries, allowed and refused statuses, permissions (logged out, another customer, admin), storefront and back office staying in sync, page refresh, error messages.
5. Show a summary table and the full cases. Save to Qase only after the user confirms (`qase_case_bulk_create`; ask for the project code if unknown), starting each description with the ticket key. Reply with the case IDs.

## Template

Give each case one purpose. Each step is one action, and each expected result is something the tester can see.

```markdown
### <Who> can/cannot <do what> <under which condition>

Ticket: SCRUM-NN | Area: Storefront/Back office/API + page
Type: functional/smoke/regression/security/usability
Behavior: positive/negative/destructive
Priority: high/medium/low | Severity: blocker/critical/major/normal/minor/trivial
Automation: manual/to-be-automated

**Preconditions:** <account, order status, anything needed before step 1>
**Test data:** <exact values, or None>

| #   | Action       | Expected result        |
| --- | ------------ | ---------------------- |
| 1   | <one action> | <what the tester sees> |

**Postconditions:** <cleanup, or None>
```
