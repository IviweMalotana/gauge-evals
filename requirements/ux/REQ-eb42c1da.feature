@id:REQ-eb42c1da @ux @status:accepted @v1 @code:src/app/(app)/dashboard/page.tsx @code:src/lib/pipeline-view.ts @code:prisma/schema.prisma
Feature: Dashboard overview of request pipeline activity

In order to monitor pipeline health and get onboarding guidance / As any team member / I want to see a dashboard showing request counts, recent activity, connection status, and helpful tips for getting started

  Scenario: View dashboard summary metrics
    Given I am signed in and belong to a company
    When I navigate to the dashboard
    Then I see the total count of all requests in my company
    And I see the count of requests awaiting approval
    And I see the count of completed requests (status DONE)
    And I see the count of team members in my company
    And I see the 5 most recent requests with their titles, types, and statuses

  Scenario: Dashboard warns when GitHub is not connected
    Given My company's GitHub connection is not yet configured
    When I view the dashboard
    Then I see a notice prompting me to connect GitHub in Settings
    And The notice explains that GitHub is needed for the pipeline to open PRs

  Scenario: Empty state when no requests exist
    Given My company has zero requests
    When I view the dashboard
    Then I see a message that nothing exists yet
    And I see a link to file my first request

  Scenario: Getting started panel provides onboarding guidance
    Given I am signed in and viewing the dashboard
    When The dashboard page loads
    Then I see a 'Getting started' panel positioned above the 'Recent requests' section
    And The panel displays a single-line tip providing actionable guidance for new users
    And The panel uses the same card styling as the existing dashboard stat panels

  Scenario: Dashboard layout remains intact with new panel
    Given The 'Getting started' panel has been added to the dashboard
    When I view the dashboard
    Then All existing dashboard elements (stat panels, recent requests, GitHub notice) remain properly aligned
    And The 'Getting started' panel does not break or misalign the existing layout
