@id:REQ-16144bf7 @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/AddMemberForm.tsx @code:src/components/BrdApproval.tsx @code:src/app/(app)/requests/new/page.tsx @code:src/app/(app)/members/page.tsx
Feature: Form Field component

Input controls for user data entry, including text inputs, textareas, and selects with consistent styling. Canonical class: `input, textarea, select`.

  Scenario: Structure
    Given a Form Field component
    Then it has label element
    And it has input/textarea/select element

  Scenario: Conformance rules
    Given a Form Field component
    Then Labels use the label element with display: block, font-size: 13px, color: var(--muted), margin: 12px 0 6px
    And Inputs, textareas, and selects have width: 100%, background: var(--panel-2), border: 1px solid var(--border), border-radius: 8px, color: var(--text), padding: 10px 12px, font-size: 14px
    And Textareas have min-height: 110px, resize: vertical
    And Focused fields have border-color: var(--accent)
    And Labels use htmlFor attribute matching input id

  Scenario: Variants
    Given a Form Field component
    Then the supported variants are text input, textarea, select dropdown
