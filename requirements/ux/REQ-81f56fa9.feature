@id:REQ-81f56fa9 @ux @status:accepted @v1 @code:src/app/(app)/settings/page.tsx @code:src/app/actions/settings.ts @code:src/app/api/oauth/github/start/route.ts @code:src/app/api/oauth/github/callback/route.ts @code:prisma/schema.prisma
Feature: Configuring company settings and GitHub integration

In order to enable the pipeline to open PRs / As an owner or admin / I want to connect GitHub OAuth, set the default repo, app URL, and preview template so the agents can interact with my repository

  Scenario: Connect GitHub via OAuth to enable PR creation
    Given GitHub OAuth is configured (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set)
    And I am an OWNER or ADMIN
    And I am on the settings page
    When I click 'Connect GitHub'
    And I authorize the app on GitHub
    And I am redirected back to the callback route
    Then The company's githubConnected flag is set to true
    And The githubLogin and encrypted githubAccessToken are stored
    And I see a success message on the settings page

  Scenario: Set the default repository for PRs
    Given GitHub is connected
    And I am an OWNER or ADMIN
    When I enter a repository in the format 'owner/repo'
    And I save the default repo setting
    Then The company's githubDefaultRepo is updated
    And The pipeline will target this repo when opening PRs

  Scenario: Set the app base URL for UX checks
    Given I am an OWNER or ADMIN
    When I enter the URL where my app runs (e.g. https://app.acme.com)
    And I save the app URL setting
    Then The company's appBaseUrl is updated
    And The UX check agent will drive this URL in a headless browser

  Scenario: Set the preview URL template for per-branch testing
    Given My deployment platform supports preview branches
    When I enter a template like 'https://app-{branch}.up.railway.app'
    And I save the preview template
    Then The company's previewUrlTemplate is updated
    And The tester agent will substitute {branch} with the actual branch name to test the preview

  Scenario: Disconnect GitHub and clear tokens
    Given GitHub is connected
    When I click 'Disconnect GitHub'
    Then The company's githubConnected is set to false
    And The githubLogin and githubAccessToken are cleared
    And The default repo remains but PRs cannot be opened until reconnected
