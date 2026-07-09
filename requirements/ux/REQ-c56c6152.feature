@id:REQ-c56c6152 @ux @status:accepted @v1 @code:src/app/(app)/requests/page.tsx @code:src/lib/pipeline-view.ts @code:prisma/schema.prisma
Feature: Viewing and filtering all company requests

In order to track all work in progress / As any team member / I want to see a list of all requests with their current status and type

  Scenario: View all requests in the company
    Given My company has filed multiple requests
    When I navigate to the requests page
    Then I see a table of all requests ordered by creation date (newest first)
    And Each row shows the title (linked to detail), type badge (BUG or FEATURE), status badge, and who filed it

  Scenario: Empty state prompts first request
    Given My company has zero requests
    When I view the requests page
    Then I see a message that no requests exist yet
    And I see a prompt to file one explaining the pipeline will run UX check and BRD
