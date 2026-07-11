@id:REQ-8274935a @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/TopBar.tsx @code:src/components/AddMemberForm.tsx @code:src/components/BrdApproval.tsx @code:src/app/(app)/dashboard/page.tsx @code:src/app/(app)/members/page.tsx @code:src/app/(app)/requests/page.tsx @code:src/app/(app)/requests/new/page.tsx
Feature: Button component

Interactive element for actions, with semantic variants for different action types (primary, secondary, success, danger). Canonical class: `.btn`.

  Scenario: Structure
    Given a Button component
    Then it has clickable surface
    And it has text label

  Scenario: Conformance rules
    Given a Button component
    Then A button always uses the .btn class
    And Primary buttons use .btn with background: var(--accent), color: #0b0d12
    And Secondary buttons add .btn.secondary with background: transparent, color: var(--text), border: 1px solid var(--border)
    And Success buttons add .btn.success with background: var(--accent-2)
    And Danger buttons add .btn.danger with background: var(--danger)
    And Small buttons add .small class for font-size: 13px
    And Disabled buttons use :disabled with opacity: 0.5, cursor: not-allowed
    And Buttons have border-radius: 8px, padding: 10px 16px, font-weight: 600, font-size: 14px

  Scenario: Variants
    Given a Button component
    Then the supported variants are primary (default), secondary, success, danger, small
