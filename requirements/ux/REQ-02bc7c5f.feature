@id:REQ-02bc7c5f @ux @status:accepted @v1 @code:src/app/(app)/requests/[id]/page.tsx @code:src/components/AutoRefresh.tsx @code:src/lib/pipeline-view.ts @code:prisma/schema.prisma
Feature: Viewing request detail and pipeline progress

In order to monitor a request's journey / As any team member / I want to see each pipeline stage's status, artifacts, and decision history in real-time

  Scenario: View request pipeline stages and artifacts
    Given A request exists in my company
    And The pipeline has progressed through various stages
    When I navigate to the request detail page
    Then I see the request title, type badge, status badge, priority, and who filed it
    And I see a visual pipeline showing stages: UX check, BRD, Plan, Build, Tests, PR
    And Each stage shows its state: pending, running, done, or blocked
    And I see the full description and context of the request
    And I see artifacts like UX check steps, BRD acceptance criteria, plan steps, build changesets, test results, and PR link if available
    And I see approval history with timestamps and approver names

  Scenario: Page auto-refreshes while request is active
    Given A request is in an active state (QUEUED, RUNNING, or AWAITING_APPROVAL)
    When I view the request detail page
    Then The page automatically refreshes every few seconds to show live pipeline progress
    And Auto-refresh stops when the request reaches terminal state (DONE, CANCELLED, FAILED)

  Scenario: Retry a failed request
    Given A request has failed (status FAILED or CANCELLED)
    When I click the retry button on the request detail page
    Then The request status is reset to QUEUED
    And A new background job is enqueued to restart the pipeline from the beginning
