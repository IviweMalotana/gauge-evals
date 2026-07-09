@id:REQ-ec6caa0b @ux @status:accepted @v1 @code:src/app/(auth)/register/page.tsx @code:src/app/actions/auth.ts @code:prisma/schema.prisma
Feature: Company registration and owner onboarding

In order to use the BA-to-QA pipeline / As a new organisation / I want to register a company account and become its owner so I can invite my team and file requests

  Scenario: Successfully create a company with owner credentials
    Given I am on the registration page
    And I have not previously registered with my email address
    When I enter a company name, my name, work email, and password of at least 8 characters
    And I submit the form
    Then A Company record is created with a unique slug derived from the company name
    And A User record is created with my details and hashed password
    And A Membership is created linking me to the company with OWNER role
    And I am signed in with a session
    And I am redirected to the dashboard

  Scenario: Registration fails when email already exists
    Given A user account already exists with my email address
    When I attempt to register with that email
    Then I see an error stating the account already exists
    And I am prompted to sign in instead

  Scenario: Registration validation enforces business rules
    Given I am filling out the registration form
    When I enter a company name shorter than 2 characters, or a password shorter than 8 characters, or an invalid email
    Then I see a validation error with the specific issue
