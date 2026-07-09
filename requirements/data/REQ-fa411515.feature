@id:REQ-fa411515 @data @status:accepted @v1 @code:prisma/schema.prisma @code:src/lib/db.ts
Feature: Multi-tenant data model with company-scoped entities

In order to isolate data per company / As the system / I want a data model where users belong to companies via memberships, and all requests/artifacts are scoped to a company

  Scenario: Company is the tenant boundary
    Given Multiple companies exist in the system
    When Users query requests, members, or artifacts
    Then All queries filter by companyId to ensure isolation
    And A user in one company cannot see another company's data

  Scenario: Request has a full pipeline artifact chain
    Given A request progresses through the pipeline
    When Agents create artifacts
    Then The request has optional one-to-one relations to UxCheck, Brd, Plan, Build, PullReq
    And The request has one-to-many relations to Check (for multiple test kinds) and Approval (for decision history)
    And All artifacts reference the request via requestId foreign key

  Scenario: Users have memberships with roles per company
    Given A user can belong to multiple companies
    When Membership records are created
    Then Each Membership has a unique (userId, companyId) pair
    And The role (OWNER, ADMIN, COLLABORATOR, STAKEHOLDER) determines permissions within that company
