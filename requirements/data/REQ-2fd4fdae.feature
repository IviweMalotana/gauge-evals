@id:REQ-2fd4fdae @data @status:accepted @v1 @code:prisma/schema.prisma @code:src/lib/requirements/seed.ts @code:src/lib/requirements/store.ts @code:src/lib/requirements/format.ts @code:src/app/actions/settings.ts
Feature: Requirements corpus storage for seeding baseline BRDs

In order to give agents context about the existing codebase / As the system / I want to store a versioned requirements corpus per company derived from the actual repository code

  Scenario: Seed requirements from repository code
    Given GitHub is connected and a default repo is set
    And An owner/admin triggers the seed action
    When A seed_requirements job runs
    Then The system clones the repository
    And An AI agent reads file contents and generates Gherkin-style requirements
    And RequirementDoc records are created for each requirement (ux, design, backend, data, api categories)
    And Each doc stores title, narrative, code areas, and scenarios in JSON
    And The job result stores the count and optionally a PR number if the corpus is committed back

  Scenario: Requirements are versioned per seed run
    Given Multiple seed jobs have run
    When A new seed job completes
    Then The version field increments for the new RequirementDocs
    And Agents can query the latest version to get current baseline context
