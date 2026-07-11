@id:REQ-ae2d92f0 @design @status:accepted @v1 @code:src/components/AddMemberForm.tsx @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/members/page.tsx @code:src/app/(app)/settings/page.tsx
Feature: Notice Banner component

Informational or alert message box for displaying system messages, warnings, or success confirmations. Canonical class: `.notice`.

  Scenario: Structure
    Given a Notice Banner component
    Then it has message container
    And it has message text

  Scenario: Conformance rules
    Given a Notice Banner component
    Then Notice banners use the .notice class
    And Notices can have border-left-color overridden via inline styles for semantic variants (e.g. var(--danger) for errors, var(--accent) for info)
    And Notices appear after form submissions or to convey important system state
