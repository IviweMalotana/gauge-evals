@id:REQ-cc9486c5 @ux @status:accepted @v1 @code:app/views/auth/signin.html @code:app/components/SignInForm
Feature: Sign-in page displays consistent 'Log in' button label

In order to maintain consistent terminology across all user touchpoints / As a user accessing the platform / I want the sign-in page to use 'Log in' button text that matches our marketing materials so the experience feels cohesive

  Scenario: Sign-in button displays 'Log in' text
    Given I am on the sign-in page
    When I view the primary call-to-action button
    Then The button displays the text 'Log in'
    And The button does not display 'Sign in' or other variants

  Scenario: Button functionality remains unchanged
    Given I am on the sign-in page
    And I have valid credentials
    When I enter my email and password
    And I click the 'Log in' button
    Then I am authenticated and signed into my account
    And The authentication behavior is identical to before the label change

  Scenario: Label is consistent across devices
    Given I access the sign-in page from desktop, tablet, or mobile device
    When I view the primary button on any supported browser
    Then The button consistently displays 'Log in' across all devices and browsers
