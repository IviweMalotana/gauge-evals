@id:REQ-e7a51bc7 @ux @status:accepted @v1 @code:src/app/(app)/requests/new/page.tsx @code:src/app/actions/requests.ts @code:prisma/schema.prisma
Feature: Filing a new request to trigger the pipeline

In order to get a feature built or bug fixed / As any team member / I want to file a request with a title, description, and priority so the pipeline can process it

  Scenario: File a request successfully
    Given I am on the new request page
    When I enter a title, description, and select a priority (low, normal, or high)
    And I submit the form
    Then A Request record is created in status QUEUED
    And The request is linked to my user as createdBy and to my company
    And A background job is enqueued to start the UX check agent
    And I am redirected to the request detail page

  Scenario: Form validation requires title and description
    Given I am filling out the new request form
    When I leave the title or description blank and attempt to submit
    Then I see validation errors prompting me to fill required fields
