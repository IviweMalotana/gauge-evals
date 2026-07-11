@id:REQ-5e51d172 @design @status:accepted @v1 @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/members/page.tsx @code:src/app/(app)/requests/page.tsx
Feature: Table component

Tabular data display with header and body rows, used for lists of members and requests. Canonical class: `table`.

  Scenario: Structure
    Given a Table component
    Then it has table element
    And it has thead with header row
    And it has tbody with data rows
    And it has th cells
    And it has td cells

  Scenario: Conformance rules
    Given a Table component
    Then Tables use the table element without a specific class
    And Tables are typically wrapped in a .card with padding: 0
    And Header cells use th elements inside thead > tr
    And Data cells use td elements inside tbody > tr
    And Small muted text in cells uses .small.muted classes
