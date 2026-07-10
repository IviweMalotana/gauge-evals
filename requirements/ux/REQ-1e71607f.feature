@id:REQ-1e71607f @ux @status:accepted @v1 @code:src/app/(auth)/login/page.tsx
Feature: Sign-in page displays welcoming 'Welcome back' subtitle

In order to create a warmer, more personalized entry point / As a returning user / I want to see a 'Welcome back' subtitle above the sign-in form so I feel recognized and welcomed

  Scenario: Welcome back subtitle is visible above form fields
    Given I am on the sign-in page
    When The page loads
    Then I see the text 'Welcome back' displayed as a subtitle
    And The subtitle appears above the email and password form fields
    And The subtitle is visible before any user interaction

  Scenario: Subtitle remains visible throughout sign-in process
    Given I am on the sign-in page
    And The 'Welcome back' subtitle is displayed
    When I interact with the form fields or submit credentials
    Then The subtitle remains visible and unchanged
    And The subtitle does not disappear or change text during the sign-in process

  Scenario: Subtitle does not interfere with existing page elements
    Given I am on the sign-in page
    When I view the form
    Then The 'Welcome back' subtitle does not overlap or obscure form field labels
    And The subtitle does not interfere with input placeholders or the 'Log in' button
    And All existing page elements remain accessible and properly positioned

  Scenario: All users see the welcome subtitle regardless of account status
    Given I am a user accessing the sign-in page
    When I view the page for the first time, as a returning user, or with any account history
    Then I see the 'Welcome back' subtitle
    And The subtitle is displayed consistently for all users regardless of authentication history
