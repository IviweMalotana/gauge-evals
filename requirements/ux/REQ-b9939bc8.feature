@id:REQ-b9939bc8 @ux @status:accepted @v1 @code:src/app/(auth)/login/page.tsx @code:src/app/actions/auth.ts @code:src/lib/auth.ts @code:src/lib/guards.ts
Feature: User authentication and session management

In order to access the system / As a registered user / I want to sign in with my credentials and maintain a secure session

  Scenario: Sign in with valid credentials
    Given I have a registered account
    And I am on the login page
    And I see the 'Welcome back' subtitle above the form
    When I enter my correct email and password
    And I submit the form
    Then The system verifies my password against the stored hash
    And A session is created for me
    And I am redirected to the dashboard

  Scenario: Sign in fails with incorrect credentials
    Given I enter an email that doesn't exist or a wrong password
    When I attempt to sign in
    Then I see an error message stating credentials are invalid
    And No session is created
    And The 'Welcome back' subtitle remains visible
