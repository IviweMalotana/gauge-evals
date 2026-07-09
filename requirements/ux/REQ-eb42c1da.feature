@id:REQ-eb42c1da @ux @status:accepted @v1 @code:src/app/(app)/dashboard/page.tsx @code:src/lib/pipeline-view.ts @code:prisma/schema.prisma
Feature: Dashboard overview of request pipeline activity

In order to monitor pipeline health / As any team member / I want to see a dashboard showing request counts, recent activity, and connection status

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
