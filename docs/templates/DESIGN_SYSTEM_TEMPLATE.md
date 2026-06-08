---
title: "Design System Template"
tags: [agent-coord-ui/template]
aliases: []
---

# [Project Name] - Design System

> Visual language reference for consistent UI across all frontend code. **Essential for AI agents** when generating components, layouts, and styling. All color values, spacing, and component patterns should reference this document.

---

## 🎨 Color Palette

### Primary Colors

> The primary color family is used for main actions, active states, and brand identity elements.

- **Primary**: `#[hex]` — [Usage: main CTA buttons, active navigation, links. Describe the color, e.g., "Deep indigo"]
- **Primary Dark**: `#[hex]` — [Usage: hover states on primary elements, pressed states. Must meet 4.5:1 contrast with white text]
- **Primary Light**: `#[hex]` — [Usage: focus rings, selected backgrounds, subtle highlights. Low opacity for layering]

### Secondary Colors (if applicable)

> Secondary colors complement the primary palette for less prominent actions and UI elements.

- **Secondary**: `#[hex]` — [Usage and color description, e.g., "Teal accent for secondary actions and data visualization"]
- **Accent**: `#[hex]` — [Usage and color description, e.g., "Warm amber for highlights, badges, and attention markers"]

### Status Colors

> Semantic colors that communicate meaning. These should be consistent across all feedback UI.

- **Success**: `#[hex]` ([color name, e.g., "Emerald"]) — [Usage: positive feedback, completed states, confirmation messages. Must pair with success-light for backgrounds]
- **Warning**: `#[hex]` ([color name, e.g., "Amber"]) — [Usage: caution states, approaching limits, non-critical alerts. Avoid using as the only indicator — pair with text/icon]
- **Error**: `#[hex]` ([color name, e.g., "Rose"]) — [Usage: error states, destructive action confirmation, form validation failures. High contrast required for accessibility]
- **Info**: `#[hex]` ([color name, e.g., "Sky"]) — [Usage: informational banners, tooltips, neutral state indicators]

### Neutral Scale

> Grays used for text, backgrounds, borders, and disabled states. The full scale ensures sufficient contrast at every level.

```
50    #[hex]  — Page background (light mode base surface)
100   #[hex]  — Alternate/card background (subtle elevation without shadow)
200   #[hex]  — Borders, dividers, subtle separators
300   #[hex]  — Disabled text, placeholder text, inactive icons
400   #[hex]  — Tertiary text, metadata, timestamps
500   #[hex]  — Secondary text, labels, descriptions
600   #[hex]  — Icons, medium-emphasis text
700   #[hex]  — Primary body text (must meet 4.5:1 contrast on white)
800   #[hex]  — Emphasized text, subheadings
900   #[hex]  — Headings, high-emphasis text (maximum contrast)
```

### Dark Mode

> Dark mode inverts the surface hierarchy while maintaining readability and reducing eye strain. All color values must meet WCAG AA contrast requirements on dark surfaces.

```
Surface:    #[hex]  — Page background (dark mode base, e.g., "Near-black, not pure #000")
Elevated:   #[hex]  — Card/modal background (subtle elevation above surface)
Muted:      #[hex]  — Alternate/inset background (lower emphasis areas)
Border:     #[hex]  — Borders, dividers (subtle, lower contrast than light mode)
Primary:    #[hex]  — Primary text on dark surface (off-white, not pure #FFF to reduce glare)
Secondary:  #[hex]  — Secondary/description text (reduced emphasis)
```

### CSS Custom Properties

> Define these in your global CSS or Tailwind theme. AI agents should use these variable names, not raw hex values.

```css
/* Example — replace with your actual CSS variable implementation */
:root {
  --color-primary: [hex];
  --color-primary-dark: [hex];
  --color-primary-light: [hex];
  /* ... continue for all tokens above */
}

[data-theme="dark"] {
  --color-surface: [hex];
  --color-primary-text: [hex];
  /* ... dark mode overrides */
}
```

---

## ✏️ Typography

### Font Stack

> Define font families with proper fallbacks. Include licensing notes and loading strategy.

```css
--font-primary:
  "[Primary Font Name, e.g., Inter]", [fallback stack, e.g.,
  "system-ui, -apple-system, sans-serif"];
--font-mono:
  "[Monospace Font Name, e.g., JetBrains Mono]", [fallback stack, e.g.,
  "'Fira Code', 'Cascadia Code', monospace"];
```

**Loading Strategy**: [How fonts are loaded — e.g., "Google Fonts via <link> with display=swap" or "Self-hosted woff2 with font-display: optional"]
**Licensing**: [Font license — e.g., "Inter: SIL Open Font License, free for commercial use"]

### Type Scale

> Each level in the type scale has a specific semantic purpose. AI agents should match content type to the appropriate level.

| Name       | Size           | Line Height | Weight               | Letter Spacing | Usage                                                            |
| ---------- | -------------- | ----------- | -------------------- | -------------- | ---------------------------------------------------------------- |
| Display    | [X]px / [X]rem | [X]         | [Bold/700]           | [X]em          | [Page titles, hero headings — used sparingly, max once per page] |
| Heading 1  | [X]px / [X]rem | [X]         | [Semibold/600]       | [X]em          | [Section headings — primary content divisions]                   |
| Heading 2  | [X]px / [X]rem | [X]         | [Semibold/600]       | [X]em          | [Subsection headings — secondary content grouping]               |
| Body Large | [X]px / [X]rem | [X]         | [Regular/400]        | normal         | [Lead paragraphs, feature descriptions — emphasis text]          |
| Body       | [X]px / [X]rem | [X]         | [Regular/400]        | normal         | [Main content, paragraphs — the default text size]               |
| Body Small | [X]px / [X]rem | [X]         | [Regular/400]        | normal         | [Supporting text, captions, helper text below inputs]            |
| Caption    | [X]px / [X]rem | [X]         | [Medium/500]         | [X]em          | [Labels, metadata, timestamps — often uppercase for labels]      |
| Code       | [X]px / [X]rem | [X]         | [Regular/400 (mono)] | normal         | [Inline code, code blocks, technical values — uses mono font]    |

---

## 📐 Spacing Scale

> Consistent spacing creates visual rhythm and hierarchy. Use these values for padding, margin, and gap. Never use arbitrary pixel values.

```
Token    Value    Usage Examples
──────   ──────   ──────────────────────────────────────────────────
1        4px      Tight spacing: between icon and label, internal badge padding
2        8px      Compact: between related form fields, inline element gaps
3        12px     Default gap: between list items, card internal padding (small)
4        16px     Standard: component internal padding, gap between form groups
5        20px     Medium: space between card sections, modal padding
6        24px     Comfortable: space between content blocks, section padding
8        32px     Generous: space between major sections, card outer margin
10       40px     Large: page section dividers, hero padding
12       48px     Extra large: major layout gaps, page top/bottom padding
16       64px     Maximum: hero sections, major layout breathing room
```

### Layout-Specific Spacing

- **Page max width**: [X]px — [E.g., "1280px for content, 1440px for full-bleed"]
- **Page padding (mobile)**: [X]px — [Horizontal padding on small screens]
- **Page padding (desktop)**: [X]px — [Horizontal padding on large screens]
- **Card padding**: [X]px — [Standard card content padding]
- **Section gap**: [X]px — [Vertical space between major page sections]

---

## 🧩 Components

> Reference implementations for core components. AI agents should follow these patterns for consistency. Use the design tokens defined above — never hardcode colors or spacing.

### Buttons

```tsx
// Primary — Main call-to-action. Use sparingly: one primary button per section.
className="bg-[primary] text-white px-4 py-2 rounded-lg font-semibold
           hover:bg-[primary-dark] active:scale-[0.98]
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[primary]
           disabled:opacity-50 disabled:cursor-not-allowed"

// Secondary — Supporting actions alongside a primary button.
className="bg-[neutral-100] text-[neutral-900] px-4 py-2 rounded-lg font-medium
           hover:bg-[neutral-200] active:bg-[neutral-300]
           dark:bg-[neutral-800] dark:text-[neutral-100] dark:hover:bg-[neutral-700]"

// Ghost — Tertiary actions, navigation, or low-emphasis contexts.
className="text-[neutral-600] px-4 py-2 rounded-lg font-medium
           hover:bg-[neutral-100] active:bg-[neutral-200]
           dark:text-[neutral-400] dark:hover:bg-[neutral-800]"

// Destructive — Delete, remove, or irreversible actions. Always requires confirmation.
className="bg-[error] text-white px-4 py-2 rounded-lg font-semibold
           hover:bg-[error-dark] focus-visible:outline-[error]"
```

**Button Sizes**:

- `sm`: `px-3 py-1.5 text-sm` — [Usage: inline actions, table rows, compact UI]
- `md`: `px-4 py-2 text-base` — [Usage: default size, forms, dialogs] (default)
- `lg`: `px-6 py-3 text-lg` — [Usage: hero CTAs, primary page actions, onboarding]

### Cards

```css
/* Standard card — the primary content container */
background: var(--color-surface); /* Light: white, Dark: elevated surface */
border: 1px solid var(--color-border); /* Subtle border, not shadow, for definition */
border-radius: 12px; /* Consistent rounding across all cards */
padding: [spacing-6]; /* 24px standard internal padding */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); /* Minimal shadow — border does the work */

/* Card hover state (for interactive cards only) */
transition:
  border-color 150ms ease-in-out,
  box-shadow 150ms ease-in-out;
hover: border-color var(--color-primary-light);
hover: box-shadow 0 2px 8px rgba(0, 0, 0, 0.08);
```

### Inputs

```css
/* Text input — standard form input */
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: 8px;
padding: 10px 12px; /* Slightly more vertical padding for touch targets */
font-size: 14px; /* Body size for readability */
line-height: 1.5;
color: var(--color-primary-text);
transition:
  border-color 150ms ease-in-out,
  box-shadow 150ms ease-in-out;

/* Focus state — clearly visible but not jarring */
&:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
  outline: none;
}

/* Error state — red border with error message below */
&[aria-invalid="true"] {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba([error-rgb], 0.15);
}

/* Disabled state */
&:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--color-muted);
}
```

### Badges / Status Indicators

```tsx
// Pattern for status badges — color communicates meaning, text provides context
// Success
className =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[success-light] text-[success-dark]";

// Warning
className =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[warning-light] text-[warning-dark]";

// Error
className =
  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[error-light] text-[error-dark]";
```

---

## ♿ Accessibility

### Contrast Requirements

> All text must meet WCAG 2.1 AA standards. Verify with a contrast checker tool when defining colors.

- **Normal text** (< 18px): Minimum **4.5:1** contrast ratio against background
- **Large text** (>= 18px or >= 14px bold): Minimum **3:1** contrast ratio
- **UI components** (icons, borders, focus indicators): Minimum **3:1** contrast ratio
- **Non-text contrast** (charts, graphs, data visualization): Minimum **3:1** contrast ratio

### Focus States

> All interactive elements MUST have visible focus indicators for keyboard navigation.

- Focus ring: **2px solid** with **2px offset** — visible on all backgrounds
- Focus ring color: `var(--color-primary)` at **50% opacity** (or `var(--color-primary-light)`)
- Use `focus-visible` (not `focus`) to show focus ring only for keyboard navigation, not mouse clicks
- Tab order must follow logical reading order — never use `tabindex > 0`

### Motion & Animation

> Respect user preferences for reduced motion. All animations must be optional.

- Default transition duration: **150ms** `ease-in-out` — [Quick enough to feel responsive, slow enough to perceive]
- Maximum animation duration: **300ms** — [Longer animations feel sluggish in utility UI]
- Respect `prefers-reduced-motion: reduce` — disable all non-essential animations
- Loading spinners and progress bars are exempt from reduced-motion (they communicate state)

### Keyboard Navigation

- All interactive elements reachable via Tab key
- Enter/Space activates buttons and links
- Escape closes modals, dropdowns, and overlays
- Arrow keys navigate within menus, tabs, and lists

---

## 🖼️ Iconography

> Consistent icon usage reinforces the visual language. Choose one icon library and stick with it.

- **Library**: [Icon library name, e.g., "Lucide React" — include version and why this library was chosen]
- **Default size**: [X]px — [E.g., "20px (matching body text line height for inline usage)"]
- **Stroke width**: [X] — [E.g., "1.75 (slightly thinner than default 2 for a lighter feel)"]
- **Style**: [Outlined / Filled / Duotone — describe the chosen style and when to deviate, e.g., "Outlined for all UI chrome; filled only for active/selected states"]
- **Color**: [How icons inherit color — e.g., "Icons inherit text color via currentColor. Never hardcode icon colors."]

### Icon Usage Guidelines

- **Navigation**: [Which icons represent nav items — be consistent across mobile/desktop]
- **Actions**: [Standard icons for common actions: edit, delete, save, close, search, filter]
- **Status**: [Icons paired with status colors: check-circle for success, alert-triangle for warning, x-circle for error]
- **Loading**: [Loading indicator pattern — spinner, skeleton, or progressive reveal]

---

## 📱 Responsive Breakpoints

> Define breakpoints and how the layout adapts at each level.

| Breakpoint | Width   | Layout Behavior                                                                            |
| ---------- | ------- | ------------------------------------------------------------------------------------------ |
| Mobile     | [< X]px | [Describe layout — e.g., "Single column, full-width cards, hamburger nav, bottom tab bar"] |
| Tablet     | [X-Y]px | [Describe layout — e.g., "Two-column grid for cards, sidebar collapses to overlay"]        |
| Desktop    | [> Y]px | [Describe layout — e.g., "Three-column layout, persistent sidebar, max-width container"]   |

---

## 📝 Notes

- [Design tool reference — e.g., "Figma file: [link] — source of truth for mockups and component specs"]
- [Theme implementation — e.g., "Dark mode toggled via data-theme attribute on <html>, persisted in localStorage"]
- [Brand guidelines — e.g., "Logo usage rules: minimum clear space of 16px, never stretch or recolor"]
- [Revision process — e.g., "Design system changes require review: update this doc, update components, update Storybook"]
