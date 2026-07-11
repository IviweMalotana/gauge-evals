@id:REQ-c8fd1716 @design @status:accepted @v1 @code:src/app/globals.css @code:src/components/TopBar.tsx @code:src/app/(app)/layout.tsx
Feature: Top Bar component

Global navigation header with branding, navigation links, and authentication controls. Canonical class: `.topbar`.

  Scenario: Structure
    Given a Top Bar component
    Then it has brand/logo section
    And it has navigation links
    And it has user actions (sign out)

  Scenario: Conformance rules
    Given a Top Bar component
    Then Top bar uses the .topbar class
    And Top bar has display: flex, align-items: center, justify-content: space-between, padding: 14px 24px, border-bottom: 1px solid var(--border), background: var(--panel)
    And Brand uses .topbar .brand with font-weight: 700, letter-spacing: 0.3px, color: var(--text)
    And Navigation links use .topbar nav a with margin-left: 18px, color: var(--muted)
    And Navigation link hover state has color: var(--text), text-decoration: none
