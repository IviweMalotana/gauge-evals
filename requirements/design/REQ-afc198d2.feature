@id:REQ-afc198d2 @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/AddMemberForm.tsx @code:src/app/(app)/dashboard/page.tsx
Feature: Grid Layout component

Responsive grid container for arranging cards and content in columns. Canonical class: `.grid`.

  Scenario: Structure
    Given a Grid Layout component
    Then it has grid container
    And it has grid items (children)

  Scenario: Conformance rules
    Given a Grid Layout component
    Then Grid containers use the .grid class
    And Grids have display: grid, gap: 16px
    And Two-column grids add .grid.cols-2 with grid-template-columns: 1fr 1fr
    And Two-column grids collapse to single column below 720px viewport width

  Scenario: Variants
    Given a Grid Layout component
    Then the supported variants are cols-2
