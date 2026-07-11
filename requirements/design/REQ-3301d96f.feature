@id:REQ-3301d96f @design @status:accepted @v1 @code:src/app/globals.css @code:src/app/(app)/layout.tsx
Feature: Container component

Page-level wrapper that constrains content width and provides horizontal padding. Canonical class: `.container`.

  Scenario: Structure
    Given a Container component
    Then it has wrapping div

  Scenario: Conformance rules
    Given a Container component
    Then Container uses the .container class
    And Container has max-width: 1040px, margin: 0 auto, padding: 24px
    And Container is applied at the layout level, wrapping page content
