@id:REQ-1eafe338 @design @status:accepted @v1 @code:src/app/globals.css @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/members/page.tsx @code:src/app/(app)/requests/page.tsx @code:src/app/(app)/settings/page.tsx @code:src/components/AddMemberForm.tsx @code:src/components/BrdApproval.tsx
Feature: Card component

A container panel for grouping related content, used throughout the app for forms, lists, and content sections. Canonical class: `.card`.

  Scenario: Structure
    Given a Card component
    Then it has background panel
    And it has border
    And it has rounded corners
    And it has padding

  Scenario: Conformance rules
    Given a Card component
    Then A card always uses the .card class
    And Cards have background: var(--panel), border: 1px solid var(--border), border-radius: var(--radius), padding: 20px
    And Cards have margin-bottom: 16px by default
    And Cards can override padding with inline styles (e.g. padding: 0 for tables)
