@id:REQ-01423cff @api @status:accepted @v1 @code:src/app/api/oauth/github/start/route.ts @code:src/app/api/oauth/github/callback/route.ts @code:src/lib/github.ts @code:src/lib/crypto.ts @code:prisma/schema.prisma
Feature: GitHub OAuth flow for repository access

In order to open pull requests on behalf of the company / As the system / I want to complete OAuth with GitHub and store an access token

  Scenario: Start GitHub OAuth flow
    Given GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are configured
    And A user is signed in
    When The user visits /api/oauth/github/start
    Then The system generates a CSRF state token and stores it in session
    And The user is redirected to GitHub's OAuth authorize URL with repo scope

  Scenario: Complete GitHub OAuth callback and store token
    Given GitHub redirects back with code and state
    When The system receives /api/oauth/github/callback
    Then The state token is validated against the session
    And The code is exchanged for an access token via GitHub API
    And The user's GitHub login is fetched
    And The company's githubConnected, githubLogin, and githubAccessToken are updated (token is encrypted in production)
    And The user is redirected to settings with a success message

  Scenario: OAuth flow fails if state mismatch
    Given The state parameter from GitHub does not match the session
    When The callback route runs
    Then An error is returned and no token is stored
