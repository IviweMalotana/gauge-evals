@id:REQ-a9b01df2 @api @status:accepted @v1 @code:src/app/api/diag/anthropic/route.ts @code:src/lib/anthropic.ts
Feature: Diagnostic endpoint for testing Anthropic API connectivity

In order to verify AI integrations during deployment / As an operator / I want a diagnostic route that tests the Anthropic API with a simple prompt

  Scenario: Test Anthropic API with a hello prompt
    Given ANTHROPIC_API_KEY is configured
    When I call GET /api/diag/anthropic
    Then The system sends a simple 'Say hello' prompt to Claude
    And The response text is returned in JSON with ok:true
    And If the API key is missing or the call fails, an error is returned with ok:false
