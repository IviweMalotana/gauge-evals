@id:REQ-b98e885f @design @status:accepted @v1 @code:src/app/globals.css
Feature: Info Panel component

Informational card component for displaying tips, notices, or guidance to users. Uses consistent panel styling for visual cohesion with dashboard cards.

  Scenario: Structure
    Given an Info Panel component
    When it is rendered
    Then it has a panel container
    And it has a title section
    And it has a content area for tip or message text

  Scenario: Conformance rules
    Given an Info Panel component
    When styled for the dashboard
    Then Info panels use the .panel class for consistent card styling
    And Info panels have background: var(--panel), padding, border: 1px solid var(--border), border-radius matching other dashboard cards
    And Title uses appropriate font-weight and color: var(--text)
    And Content text uses color: var(--muted) for readability hierarchy
