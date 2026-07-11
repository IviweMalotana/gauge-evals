@id:REQ-c2a57f7a @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/TopBar.tsx @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/requests/page.tsx @code:src/app/(app)/members/page.tsx
Feature: Badge component

Small inline label for categorizing or showing status, with semantic color variants for different types (bug, feature, status, role). Canonical class: `.badge`.

  Scenario: Structure
    Given a Badge component
    Then it has inline container
    And it has text label
    And it has border

  Scenario: Conformance rules
    Given a Badge component
    Then A badge always uses the .badge class
    And Default badges have color: var(--muted), border: 1px solid var(--border)
    And Bug badges add .badge.bug with color and border-color: var(--danger)
    And Feature badges add .badge.feature with color and border-color: var(--accent-2)
    And Status badges add .badge.status with color and border-color: var(--accent)
    And Role badges add .badge.role with color: var(--warn)
    And Badges have display: inline-block, padding: 2px 9px, border-radius: 999px, font-size: 12px, font-weight: 600

  Scenario: Variants
    Given a Badge component
    Then the supported variants are default, bug, feature, status, role
