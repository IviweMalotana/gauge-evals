@id:REQ-49699458 @ux @status:accepted @v1 @code:src/app/(app)/members/page.tsx @code:src/components/AddMemberForm.tsx @code:src/app/actions/members.ts @code:src/lib/auth.ts @code:prisma/schema.prisma
Feature: Managing team members and roles

In order to collaborate / As an owner or admin / I want to invite collaborators, assign roles, and remove members from my company

  Scenario: Add a new collaborator with a temporary password
    Given I am an OWNER or ADMIN
    And I am on the members page
    When I enter an email that does not yet have an account, a name, and select a role
    And I submit the add member form
    Then A new User record is created with a deterministic temporary password
    And A Membership record links the user to my company with the chosen role
    And I see a success message showing the temporary password to share out-of-band

  Scenario: Add an existing user as a member
    Given A user already exists with the email I enter
    And That user is not yet a member of my company
    When I add them via the form
    Then A Membership is created linking them to my company
    And No new User record is created
    And I see a success message (no temporary password needed)

  Scenario: Change a member's role
    Given I am an OWNER or ADMIN
    And A member exists in my company
    When I select a different role from the dropdown next to their name
    And I click Save
    Then The Membership role is updated to the new value

  Scenario: Remove a member from the company
    Given I am an OWNER or ADMIN
    And A member exists who is not me
    When I click the remove button next to their row
    Then The Membership record is deleted
    And The user no longer has access to my company's data

  Scenario: Collaborators can view but not manage members
    Given I am a COLLABORATOR
    When I navigate to the members page
    Then I see the list of all members
    And I do not see the add member form or role change controls
    And I see a notice that only owners and admins can manage members
