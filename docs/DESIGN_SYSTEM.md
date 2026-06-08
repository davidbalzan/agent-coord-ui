---
title: "Design System — agent-coord-ui"
tags: [agent-coord-ui/core]
aliases: ["Design System", "DESIGN_SYSTEM"]
---

# agent-coord-ui — Design System

> Visual language reference for the holographic command-centre aesthetic. **Essential for AI agents** when generating components, layouts, and styling. All colour values, spacing, and component patterns reference this document.

---

## 🎨 Aesthetic Direction

**Theme**: Holographic command interface — deep space navy background, electric cyan as the primary system glow colour, amber/green/red for agent status semantics. Inspired by sci-fi HUD/LCARS aesthetics. Functional and dense, not decorative.

**Core Principle**: Every element should feel like it is _transmitting_ information. Glows communicate status. Monospace type communicates precision. Angular clip-paths communicate military efficiency.

---

## 🎨 Colour Palette

### Primary System Colours

- **Surface** `#000913` — Page background. Near-black with deep blue undertone; never pure `#000`.
- **Muted** `#060f20` — Card/panel inset backgrounds.
- **Border** `#0d2847` — Inactive borders.
- **Accent / Glow** `#00d4ff` — Electric cyan. All active borders, glows, focus rings, and interactive affordances.
- **Text Primary** `#8ecfff` — Soft blue-white. Default readable text on dark surfaces.
- **Text Secondary** `#4a9abe` — Reduced-emphasis labels.
- **Text Dim** `#1e4d7a` — Placeholders, decorative separators.

### Status / Semantic Colours

| Status          | Colour    | Usage                                      |
| --------------- | --------- | ------------------------------------------ |
| Active / Online | `#00ff88` | Agent active state, success confirmations  |
| Idle / Standby  | `#ff8c00` | Agent idle state, warnings                 |
| Stale / Offline | `#ff3333` | Disconnected agents, errors                |
| Room node       | `#7b6fff` | Room nodes in 3D graph, room panel accents |

### CSS Custom Properties (defined in `index.css` via Tailwind `@theme`)

```css
--color-surface: #000913;
--color-muted: #060f20;
--color-border: #0d2847;
--color-primary: #8ecfff;
--color-secondary: #4a9abe;
--color-tertiary: #1e4d7a;
--color-accent: #00d4ff;
--color-active: #00ff88;
--color-warning: #ff8c00;
--color-danger: #ff3333;
--color-room: #7b6fff;
```

---

## ✍️ Typography

### Font Stack

| Role    | Family            | Usage                                                                                          |
| ------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| Display | `Orbitron`        | HUD system names, node/panel headers, button labels — max 14px, always uppercase or title-case |
| Mono    | `Share Tech Mono` | All data readouts: IDs, timestamps, metadata labels, status strings, compose placeholder text  |
| Body    | `Exo 2`           | Message content, descriptions, paragraph text — the only font used above 13px in panels        |

### Type Scale

| Use          | Font            | Size    | Weight | Letter-spacing | Case      |
| ------------ | --------------- | ------- | ------ | -------------- | --------- |
| System logo  | Orbitron        | 11px    | 700    | 0.2em          | uppercase |
| Panel header | Orbitron        | 12px    | 600    | 0.1em          | uppercase |
| Button label | Orbitron        | 10px    | 600    | 0.1em          | uppercase |
| Data label   | Share Tech Mono | 9px     | 400    | 0.15–0.2em     | uppercase |
| Data value   | Share Tech Mono | 10–11px | 400    | 0.05–0.1em     | mixed     |
| Message body | Exo 2           | 12px    | 400    | normal         | sentence  |
| HUD stat     | Share Tech Mono | 11px    | 400    | 0.05em         | uppercase |

---

## 💡 Glow System

Glows communicate live state. They are additive — never block out surrounding elements.

```css
/* Active node pulse (CSS animation) */
@keyframes glow-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Border glow cycle (panels) */
@keyframes border-glow {
  0%,
  100% {
    box-shadow:
      0 0 8px rgba(0, 212, 255, 0.3),
      inset 0 0 8px rgba(0, 212, 255, 0.05);
  }
  50% {
    box-shadow:
      0 0 16px rgba(0, 212, 255, 0.6),
      inset 0 0 16px rgba(0, 212, 255, 0.1);
  }
}
```

**Status glow values**:

```css
/* Active */
box-shadow:
  0 0 8px #00ff88,
  0 0 16px rgba(0, 255, 136, 0.4);
/* Idle */
box-shadow:
  0 0 8px #ff8c00,
  0 0 16px rgba(255, 140, 0, 0.4);
/* Stale */
box-shadow:
  0 0 8px #ff3333,
  0 0 16px rgba(255, 51, 51, 0.4);
/* Accent */
box-shadow: 0 0 12px rgba(0, 212, 255, 0.5);
```

### Three.js Node Glow

Each node uses a `THREE.Group` with three layers:

1. **Core sphere** — `MeshPhongMaterial`, emissive = status colour, `emissiveIntensity: 0.9`
2. **Halo 1** — radius × 1.7, `MeshBasicMaterial`, opacity 0.18, `AdditiveBlending`
3. **Halo 2** — radius × 2.8, `MeshBasicMaterial`, opacity 0.07, `AdditiveBlending`
4. **PointLight** — intensity 1.5, distance = radius × 8, colour = status colour

---

## 🔲 Component Patterns

### Panel Layout (`.holo-panel`)

```css
background: rgba(0, 15, 35, 0.85);
border: 1px solid rgba(0, 212, 255, 0.25);
backdrop-filter: blur(12px);
animation: border-glow 3s ease-in-out infinite;
```

Corner brackets (before/after pseudo-elements):

```css
/* Top-left corner */
border-width: 2px 0 0 2px;
color: #00d4ff;
/* Bottom-right corner */
border-width: 0 2px 2px 0;
color: #00d4ff;
```

### Buttons (`.holo-btn`)

```css
background: rgba(0, 212, 255, 0.08);
border: 1px solid rgba(0, 212, 255, 0.4);
color: #00d4ff;
font-family: Orbitron;
font-size: 0.7rem;
letter-spacing: 0.1em;
clip-path: polygon(
  0 0,
  calc(100% - 6px) 0,
  100% 6px,
  100% 100%,
  6px 100%,
  0 calc(100% - 6px)
);
```

Hover state: `background` → 0.18 alpha, `border-color` → 0.8 alpha, add `box-shadow: 0 0 16px rgba(0,212,255,0.4)`.

### Inputs (`.holo-input`)

```css
background: rgba(0, 212, 255, 0.04);
border: 1px solid rgba(0, 212, 255, 0.2);
color: #8ecfff;
font-family: Share Tech Mono;
clip-path: polygon(
  0 0,
  calc(100% - 8px) 0,
  100% 8px,
  100% 100%,
  8px 100%,
  0 calc(100% - 8px)
);
```

Focus: border → 0.6 alpha, `box-shadow: 0 0 12px rgba(0,212,255,0.2)`, `background` → 0.08 alpha, text → `#ffffff`.

### Member / Tag Chips

```css
font-family: Share Tech Mono;
font-size: 9px;
letter-spacing: 0.08em;
color: rgba(0, 212, 255, 0.7);
background: rgba(0, 212, 255, 0.06);
border: 1px solid rgba(0, 212, 255, 0.2);
clip-path: polygon(
  0 0,
  calc(100% - 4px) 0,
  100% 4px,
  100% 100%,
  4px 100%,
  0 calc(100% - 4px)
);
```

### Message Bubbles

Operator messages (right-aligned):

```css
clip-path: polygon(
  0 0,
  100% 0,
  100% calc(100% - 6px),
  calc(100% - 6px) 100%,
  0 100%
);
background: rgba(0, 212, 255, 0.07);
border: 1px solid rgba(0, 212, 255, 0.2);
color: #8ecfff;
```

Agent messages (left-aligned):

```css
clip-path: polygon(0 0, 100% 0, 100% 100%, 6px 100%, 0 calc(100% - 6px));
background: rgba(0, 255, 136, 0.05);
border: 1px solid rgba(0, 255, 136, 0.15);
color: #c8f7e4;
```

---

## 🌐 Global Overlays

Applied on `body` — do not remove:

- **Scanlines** (`body::after`): `repeating-linear-gradient` at 4px pitch, `rgba(0,212,255,0.015)` — adds CRT texture depth.
- **Grain** (`body::before`): SVG `feTurbulence` noise overlay, opacity 0.3 — reduces harsh digital flatness.

---

## 📜 Scrollbars

```css
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 212, 255, 0.03);
}
::-webkit-scrollbar-thumb {
  background: rgba(0, 212, 255, 0.3);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 212, 255, 0.6);
}
```

---

## 🔗 Related Documents

- **[[TECH_STACK|Tech Stack]]** - Font imports, Tailwind config location
- **[[ARCHITECTURE_GUIDE|Architecture Guide]]** - Three.js glow implementation details
- **[[DECISIONS|Decisions Log]]** - ADR for the holographic theme choice
