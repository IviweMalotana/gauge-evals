# Component library

The strict definitions of this codebase's UI components, extracted by **Baton**
from the current code. Each component is also a design-category requirement in
`requirements/design/`; Baton's UI fixer checks changed UI against these
rules.

## Card

A container panel for grouping related content, used throughout the app for forms, lists, and content sections.

- **Class:** `.card`
- **Defined in:** `src/app/globals.css`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/members/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/settings/page.tsx`, `src/components/AddMemberForm.tsx`, `src/components/BrdApproval.tsx`

**Anatomy**
- background panel
- border
- rounded corners
- padding

**Rules**
- A card always uses the .card class
- Cards have background: var(--panel), border: 1px solid var(--border), border-radius: var(--radius), padding: 20px
- Cards have margin-bottom: 16px by default
- Cards can override padding with inline styles (e.g. padding: 0 for tables)

## Button

Interactive element for actions, with semantic variants for different action types (primary, secondary, success, danger).

- **Class:** `.btn`
- **Variants:** `primary (default)`, `secondary`, `success`, `danger`, `small`
- **Defined in:** `src/app/globals.css`, `src/components/TopBar.tsx`, `src/components/AddMemberForm.tsx`, `src/components/BrdApproval.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/members/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/requests/new/page.tsx`

**Anatomy**
- clickable surface
- text label

**Rules**
- A button always uses the .btn class
- Primary buttons use .btn with background: var(--accent), color: #0b0d12
- Secondary buttons add .btn.secondary with background: transparent, color: var(--text), border: 1px solid var(--border)
- Success buttons add .btn.success with background: var(--accent-2)
- Danger buttons add .btn.danger with background: var(--danger)
- Small buttons add .small class for font-size: 13px
- Disabled buttons use :disabled with opacity: 0.5, cursor: not-allowed
- Buttons have border-radius: 8px, padding: 10px 16px, font-weight: 600, font-size: 14px

## Badge

Small inline label for categorizing or showing status, with semantic color variants for different types (bug, feature, status, role).

- **Class:** `.badge`
- **Variants:** `default`, `bug`, `feature`, `status`, `role`
- **Defined in:** `src/app/globals.css`, `src/components/TopBar.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/members/page.tsx`

**Anatomy**
- inline container
- text label
- border

**Rules**
- A badge always uses the .badge class
- Default badges have color: var(--muted), border: 1px solid var(--border)
- Bug badges add .badge.bug with color and border-color: var(--danger)
- Feature badges add .badge.feature with color and border-color: var(--accent-2)
- Status badges add .badge.status with color and border-color: var(--accent)
- Role badges add .badge.role with color: var(--warn)
- Badges have display: inline-block, padding: 2px 9px, border-radius: 999px, font-size: 12px, font-weight: 600

## Form Field

Input controls for user data entry, including text inputs, textareas, and selects with consistent styling.

- **Class:** `input, textarea, select`
- **Variants:** `text input`, `textarea`, `select dropdown`
- **Defined in:** `src/app/globals.css`, `src/components/AddMemberForm.tsx`, `src/components/BrdApproval.tsx`, `src/app/(app)/requests/new/page.tsx`, `src/app/(app)/members/page.tsx`

**Anatomy**
- label element
- input/textarea/select element

**Rules**
- Labels use the label element with display: block, font-size: 13px, color: var(--muted), margin: 12px 0 6px
- Inputs, textareas, and selects have width: 100%, background: var(--panel-2), border: 1px solid var(--border), border-radius: 8px, color: var(--text), padding: 10px 12px, font-size: 14px
- Textareas have min-height: 110px, resize: vertical
- Focused fields have border-color: var(--accent)
- Labels use htmlFor attribute matching input id

## Top Bar

Global navigation header with branding, navigation links, and authentication controls.

- **Class:** `.topbar`
- **Defined in:** `src/app/globals.css`, `src/components/TopBar.tsx`, `src/app/(app)/layout.tsx`

**Anatomy**
- brand/logo section
- navigation links
- user actions (sign out)

**Rules**
- Top bar uses the .topbar class
- Top bar has display: flex, align-items: center, justify-content: space-between, padding: 14px 24px, border-bottom: 1px solid var(--border), background: var(--panel)
- Brand uses .topbar .brand with font-weight: 700, letter-spacing: 0.3px, color: var(--text)
- Navigation links use .topbar nav a with margin-left: 18px, color: var(--muted)
- Navigation link hover state has color: var(--text), text-decoration: none

## Table

Tabular data display with header and body rows, used for lists of members and requests.

- **Class:** `table`
- **Defined in:** `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/members/page.tsx`, `src/app/(app)/requests/page.tsx`

**Anatomy**
- table element
- thead with header row
- tbody with data rows
- th cells
- td cells

**Rules**
- Tables use the table element without a specific class
- Tables are typically wrapped in a .card with padding: 0
- Header cells use th elements inside thead > tr
- Data cells use td elements inside tbody > tr
- Small muted text in cells uses .small.muted classes

## Grid Layout

Responsive grid container for arranging cards and content in columns.

- **Class:** `.grid`
- **Variants:** `cols-2`
- **Defined in:** `src/app/globals.css`, `src/components/AddMemberForm.tsx`, `src/app/(app)/dashboard/page.tsx`

**Anatomy**
- grid container
- grid items (children)

**Rules**
- Grid containers use the .grid class
- Grids have display: grid, gap: 16px
- Two-column grids add .grid.cols-2 with grid-template-columns: 1fr 1fr
- Two-column grids collapse to single column below 720px viewport width

## Notice Banner

Informational or alert message box for displaying system messages, warnings, or success confirmations.

- **Class:** `.notice`
- **Defined in:** `src/components/AddMemberForm.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/members/page.tsx`, `src/app/(app)/settings/page.tsx`

**Anatomy**
- message container
- message text

**Rules**
- Notice banners use the .notice class
- Notices can have border-left-color overridden via inline styles for semantic variants (e.g. var(--danger) for errors, var(--accent) for info)
- Notices appear after form submissions or to convey important system state

## Container

Page-level wrapper that constrains content width and provides horizontal padding.

- **Class:** `.container`
- **Defined in:** `src/app/globals.css`, `src/app/(app)/layout.tsx`

**Anatomy**
- wrapping div

**Rules**
- Container uses the .container class
- Container has max-width: 1040px, margin: 0 auto, padding: 24px
- Container is applied at the layout level, wrapping page content

## Row Layout

Horizontal flexbox container for arranging elements in a row with optional spacing.

- **Class:** `.row`
- **Defined in:** `src/components/TopBar.tsx`, `src/components/BrdApproval.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/members/page.tsx`

**Anatomy**
- flex container
- flex items (children)

**Rules**
- Rows use the .row class (implied from usage, not defined in globals.css)
- Rows use display: flex implied by usage patterns
- Rows can include .spacer for flexible spacing
- Rows can have gap property set via inline styles

## Utility Classes

Single-purpose helper classes for common text and display modifications.

- **Class:** `.muted, .small, .mono, .spacer`
- **Variants:** `muted`, `small`, `mono`, `spacer`
- **Defined in:** `src/app/globals.css`, `src/components/TopBar.tsx`, `src/components/AddMemberForm.tsx`, `src/components/BrdApproval.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/members/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/settings/page.tsx`

**Anatomy**
- text or element

**Rules**
- Muted text uses .muted with color: var(--muted)
- Small text uses .small with font-size: 13px
- Monospace text uses .mono with font-family: ui-monospace, SFMono-Regular, Menlo, monospace and font-size: 13px
- Spacer uses .spacer for flex: 1 spacing (implied from usage)
- Utility classes can be combined (e.g. .small.muted)

_Total: 11 component(s)._
