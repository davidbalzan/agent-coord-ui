# Agent Coord UI — Component Conventions

## Components

Two components: `Button` and `Tooltip`, both exported from `@coord-ui/ui` (`window.CoordUI`).

## No provider needed

Components require no wrapper — render them directly.

## Styling idiom: Tailwind v4 utility classes with custom tokens

This DS uses Tailwind v4 utility classes mapped to custom design tokens. **No CSS classes to invent** — use only utilities from the token vocabulary below.

### Color tokens (used as Tailwind utility suffixes)

| Token       | Value     | Usage                                   |
| ----------- | --------- | --------------------------------------- |
| `surface`   | `#000913` | Page/card background                    |
| `muted`     | `#060f20` | Secondary surfaces, button secondary bg |
| `border`    | `#0d2847` | Borders, button secondary border        |
| `primary`   | `#8ecfff` | Default text, tooltip background        |
| `secondary` | `#4a9abe` | Secondary text                          |
| `accent`    | `#00d4ff` | Primary action buttons, highlights      |
| `active`    | `#00ff88` | Success/active states                   |
| `warning`   | `#ff8c00` | Warning states                          |
| `danger`    | `#ff3333` | Error/destructive states                |

Example: `bg-surface`, `text-primary`, `border-border`, `bg-accent`, `text-accent`

### Font families

- `font-sans` — Exo 2 (body text, default)
- `font-mono` — Share Tech Mono (code, data)
- `font-display` — Orbitron (headings, labels, buttons)

## Button API

```tsx
import { Button } from '@coord-ui/ui'

// variant: "primary" | "secondary" | "ghost" | "icon"
// size: "sm" | "md" | "lg"
<Button variant="primary" size="md">Label</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost">Dismiss</Button>
<Button variant="icon">✕</Button>
<Button variant="primary" disabled>Disabled</Button>
```

## Tooltip API

```tsx
import { Tooltip } from "@coord-ui/ui";

// Tooltip is hover-triggered — wraps any child
<Tooltip content="Description text" shortcut="⌘K">
  <Button variant="icon">⊕</Button>
</Tooltip>;
```

## Where styling truth lives

Read `_ds_bundle.css` (the compiled Tailwind utilities for this DS) and `styles.css` (entry that imports it) for the full token and utility set. Per-component docs are in `components/general/<Name>/<Name>.prompt.md`.

## Idiomatic example

```tsx
import { Button, Tooltip } from "@coord-ui/ui";

export function ActionBar() {
  return (
    <div className="flex gap-2 items-center bg-surface p-3 border-b border-border">
      <Button variant="primary" size="sm">
        Deploy
      </Button>
      <Button variant="secondary" size="sm">
        Cancel
      </Button>
      <Tooltip content="Settings" shortcut="⌘,">
        <Button variant="icon">⚙</Button>
      </Tooltip>
    </div>
  );
}
```
