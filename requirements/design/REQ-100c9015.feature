@id:REQ-100c9015 @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/TopBar.tsx @code:src/components/AddMemberForm.tsx @code:src/components/BrdApproval.tsx @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/members/page.tsx @code:src/app/(app)/requests/page.tsx @code:src/app/(app)/settings/page.tsx
Feature: Utility Classes component

Single-purpose helper classes for common text and display modifications. Canonical class: `.muted, .small, .mono, .spacer`.

  Scenario: Structure
    Given a Utility Classes component
    Then it has text or element

  Scenario: Conformance rules
    Given a Utility Classes component
    Then Muted text uses .muted with color: var(--muted)
    And Small text uses .small with font-size: 13px
    And Monospace text uses .mono with font-family: ui-monospace, SFMono-Regular, Menlo, monospace and font-size: 13px
    And Spacer uses .spacer for flex: 1 spacing (implied from usage)
    And Utility classes can be combined (e.g. .small.muted)

  Scenario: Variants
    Given a Utility Classes component
    Then the supported variants are muted, small, mono, spacer
