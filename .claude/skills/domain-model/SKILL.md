---
name: domain-model
description: Build and sharpen the project's domain model — a ubiquitous-language glossary (and bounded-context map for larger systems). Use during system design (kickstart/plan-phase) or whenever terminology is fuzzy, conflicting, or being decided.
argument-hint: "[term or area to model]"
---

# Domain Model - Ubiquitous Language & Bounded Contexts

The _active_ discipline of building the domain model as you design: challenge terms,
invent edge-case scenarios, and write the glossary down the moment it crystallises. (Merely
_reading_ the glossary for vocabulary isn't this skill — this is for _changing_ the model.)

> Adapted (MIT) from Matt Pocock's `domain-modeling` skill
> (github.com/mattpocock/skills), fitted to Groundwork's docs vault and `[[DECISIONS]]`.

Outputs (created **lazily**, only when there's something to write):

- **`docs/CONTEXT.md`** — the ubiquitous-language glossary (single context).
- **`docs/CONTEXT-MAP.md`** — only for multiple **bounded contexts**: lists each context,
  where it lives, and how they relate. A `CONTEXT.md` sits beside each context's code.

Both start with YAML frontmatter and use `[[wikilinks]]`.

**Who runs this:** the product-context holder (you, or a coordinator acting as your proxy) —
defining the ubiquitous language is a spec decision, not execution. A narrow worker lacks the
product context to settle term conflicts, so don't delegate the model itself; workers _consume_
`CONTEXT.md`, they don't author it.

## During a design session

- **Challenge against the glossary.** If a term conflicts with `CONTEXT.md`, call it out:
  "Your glossary defines 'cancellation' as X, but you mean Y — which is it?"
- **Sharpen fuzzy language.** Propose a precise canonical term for vague/overloaded words.
  "You said 'account' — Customer or User? Those differ."
- **Stress-test with concrete scenarios** that force precision about boundaries between concepts.
- **Cross-reference with code**; surface contradictions.
- **Update `CONTEXT.md` inline** — capture each resolved term as it happens. Keep it
  **devoid of implementation detail**: it's a glossary, not a spec.

## CONTEXT.md format

```markdown
---
title: "Domain Context"
tags: [groundwork/core]
aliases: ["Ubiquitous Language", "Glossary", "CONTEXT"]
---

# {Context Name}

{One or two sentences: what this context is and why it exists.}

## Language

**Order**: A confirmed, priced customer request ready to fulfil.
_Avoid_: Purchase, transaction
**Customer**: A person or organization that places orders.
_Avoid_: Client, buyer, account
```

Rules: be opinionated (pick one term, list the rest under `_Avoid_`); tight definitions
(1–2 sentences, what it _is_ not what it _does_); only context-specific terms (no general
programming concepts); group under subheadings when clusters emerge.

## CONTEXT-MAP.md format (multi-context only)

```markdown
---
title: "Context Map"
tags: [groundwork/core]
aliases: ["Context Map"]
---

# Context Map

## Contexts

- [[ordering/CONTEXT|Ordering]] — receives and tracks customer orders
- [[billing/CONTEXT|Billing]] — generates invoices and processes payments

## Relationships

- **Ordering → Billing**: Ordering emits `OrderPlaced`; Billing consumes it to invoice
- **Ordering ↔ Billing**: shared types `CustomerId`, `Money`
```

## Decisions

When modeling surfaces a real architectural decision, record it with `/log-decision` — but
**only when all three hold**: hard to reverse, surprising without context, a real trade-off.
Boundary/ownership decisions ("Customer data is owned by the Customer context; others
reference it by ID") are prime ADR material.

`/kickstart` runs this during architecture design; `/plan-phase` uses the glossary to name
tasks/types precisely.

Term or area to model: $ARGUMENTS
