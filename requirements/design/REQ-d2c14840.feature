@id:REQ-d2c14840 @design @status:accepted @v1 @code:src/components/TopBar.tsx @code:src/components/BrdApproval.tsx @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/requests/page.tsx @code:src/app/(app)/members/page.tsx
Feature: Row Layout component

Horizontal flexbox container for arranging elements in a row with optional spacing. Canonical class: `.row`.

  Scenario: Structure
    Given a Row Layout component
    Then it has flex container
    And it has flex items (children)

  Scenario: Conformance rules
    Given a Row Layout component
    Then Rows use the .row class (implied from usage, not defined in globals.css)
    And Rows use display: flex implied by usage patterns
    And Rows can include .spacer for flexible spacing
    And Rows can have gap property set via inline styles
