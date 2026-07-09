@id:REQ-b6f65576 @backend @status:accepted @v1 @code:src/lib/agents/orchestrator.ts @code:src/lib/agents/uxCheck.ts @code:src/lib/agents/brd.ts @code:src/lib/agents/planner.ts @code:src/lib/agents/builder.ts @code:src/lib/agents/tester.ts @code:src/lib/agents/pr.ts @code:src/lib/queue.ts @code:prisma/schema.prisma
Feature: Multi-agent pipeline orchestration for request processing

In order to automate BA-to-QA workflows / As the system / I want to run a sequence of AI agents that classify, draft BRD, plan, build, test, and open PRs for each request

  Scenario: UX check agent classifies request as BUG or FEATURE
    Given A request is filed and enqueued
    When The orchestrator picks up the job
    And The UX check agent runs
    Then The agent drives the app base URL in a headless browser
    And It reads the request description and observes the app behaviour
    And It sets the request type to BUG or FEATURE based on analysis
    And A UxCheck record is created with classification reasoning and reproduction steps
    And The request status moves to RUNNING
    And The orchestrator advances to the BRD agent

  Scenario: BRD agent drafts acceptance criteria and pauses for approval
    Given The UX check is complete
    When The BRD agent runs
    Then The agent generates acceptance criteria based on the request and UX check findings
    And A Brd record is created with acceptanceCriteria JSON array
    And The request status changes to AWAITING_APPROVAL
    And The pipeline pauses until a human approves or rejects

  Scenario: Planner agent creates a step-by-step implementation plan
    Given The BRD is approved
    When The planner agent runs
    Then The agent generates implementation steps from the BRD
    And A Plan record is created with steps JSON array
    And The orchestrator advances to the builder agent

  Scenario: Builder agent generates code changes and opens a feature branch
    Given The plan is ready
    When The builder agent runs
    Then The agent generates code changes (file paths and content)
    And A Build record is created with changesets JSON
    And A feature branch is created in the GitHub repo
    And Changes are committed to the branch
    And The orchestrator advances to the tester agent

  Scenario: Tester agent runs acceptance, bugfix, and regression checks
    Given The build is complete and a preview URL is available
    When The tester agent runs
    Then Three Check records are created: acceptance, bugfix, regression
    And Each check drives the preview URL in a browser agent to verify behaviour
    And Check results (passed, failed, screenshots, reasoning) are stored
    And The orchestrator advances to the PR agent

  Scenario: PR agent opens a pull request with full context
    Given All tests have run
    When The PR agent runs
    Then A pull request is opened on GitHub linking the feature branch to the default branch
    And The PR body includes BRD, plan, test results, and screenshots
    And A PullReq record is created with the PR number and URL
    And The request status changes to DONE
    And The pipeline completes
