@id:REQ-52a472ba @ux @status:accepted @v1 @code:src/app/(app)/requests/[id]/page.tsx @code:src/components/BrdApproval.tsx @code:src/app/actions/requests.ts @code:prisma/schema.prisma
Feature: Approving or rejecting a BRD to gate pipeline progression

In order to ensure quality before code is written / As a stakeholder with approval rights / I want to review the drafted BRD and either approve it to continue or reject it to halt the request

  Scenario: Approve a BRD to allow pipeline to proceed
    Given A request is in AWAITING_APPROVAL status
    And I have approval rights (OWNER, ADMIN, or STAKEHOLDER role)
    When I review the BRD acceptance criteria
    And I click Approve
    Then An Approval record is created with decision APPROVED
    And The request status changes to RUNNING
    And The pipeline resumes and proceeds to the planner agent stage

  Scenario: Reject a BRD to stop the request
    Given A request is in AWAITING_APPROVAL status
    And I have approval rights
    When I provide a rejection reason
    And I click Reject
    Then An Approval record is created with decision REJECTED and the reason stored
    And The request status changes to CANCELLED
    And The pipeline stops and no further stages run

  Scenario: Approval UI hidden for users without permission
    Given I have COLLABORATOR role (no approval rights)
    When I view a request awaiting approval
    Then I do not see the Approve/Reject buttons
    And I see a notice that approval is required from a stakeholder
