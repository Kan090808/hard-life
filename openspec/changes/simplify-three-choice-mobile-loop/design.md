## Context

The current implementation grew from a one-action survival loop into a slot planner with nested action choices, attendance phases, mid-action events, zero-slot utility actions, persistent projects, and an expandable dashboard. The redesign intentionally contracts that surface. The game remains a deterministic, data-driven browser game, but its public interaction model becomes one contextual decision at a time.

## Goals / Non-Goals

**Goals:**

- Make every active game state understandable from one phone screen.
- Guarantee exactly three normal decisions per day: morning, afternoon, and evening.
- Present no more than three valid actions at any decision point.
- Preserve meaningful money, energy, stress, skill, work, rent, and condition trade-offs.
- Keep option generation and effects testable without a browser.
- Complete a normal run in roughly 10 to 15 minutes.

**Non-Goals:**

- Preserving save compatibility with the previous state shape.
- Preserving every existing event, ending tag, achievement, analytics field, or action.
- Supporting free-form scheduling, manual sleep, multi-day projects, travel simulation, or a separate relationship system.
- Making desktop use materially different from the mobile experience.

## Decisions

### Replace phases and planners with one period cursor

State stores a `periodIndex` over morning, afternoon, and evening. Choosing an option applies its effects, records a compact result, and increments the cursor. Resolving evening automatically applies living costs, rent, recovery, condition updates, and day advancement.

Alternative considered: keep the current slot planner and hide controls in the UI. This would leave nested phases and edge cases in the engine, making the simplified interface misleading and difficult to verify.

### Generate a small contextual option set from prioritized pools

The engine first adds mandatory context options, such as going to a scheduled job or fixing an active problem, and then fills remaining positions from income, recovery, and growth pools. It filters unaffordable or invalid options, removes duplicate intents, and caps the result at three.

Alternative considered: expose three fixed universal actions. That is simpler but produces a solved pattern and prevents work, rent, and persistent conditions from shaping play.

### Keep four mutable resources and one passive trait

Money, energy, stress, and skill remain mutable and visible. A new run receives one passive trait that modifies starting state or a narrow effect. Mood and the four existing character attributes are removed from active management.

Alternative considered: retain hidden versions of removed stats. Hidden mutable values would make outcomes harder to explain and would not reduce engine complexity.

### Treat employment as state, not a separate daily workflow

Employment has three levels: unemployed, part-time, and full-time. Work and job search are normal contextual actions. Missing work increases a small absence counter; repeated absence can demote or remove the job at day settlement. Freelance work is an occasional skill-gated option and does not create a fourth job state.

Alternative considered: retain the attendance dialog before the free-action flow. That would make employed players perform more than three daily decisions.

### Fold events into the current situation

An event selects the situation copy and may inject or replace options for the current period. There is no separate event phase or modal. After selection, a compact result is shown inline and the player explicitly continues to the next period to retain readability without adding another decision.

Alternative considered: auto-advance after an animation. Explicit continuation avoids players missing numeric changes, while the continue tap is navigation rather than a strategic choice.

### Build the UI around a 360 by 640 reference viewport

The game shell uses a compact top bar, five tappable status items, one flexible situation panel, and a bottom option stack. Status explanations use a bottom sheet. The normal active state contains no fold control and should not require vertical scrolling at the reference viewport.

Alternative considered: retain the existing card dashboard with smaller spacing. That still gives permanent space to secondary information and reduces the room available for choices.

## Risks / Trade-offs

- [Contextual options can feel arbitrary] -> Give each option a direct effect preview and ensure each injected option has visible narrative justification.
- [Three decisions across 21 days may still become repetitive] -> Vary situation copy, use period-specific pools, and allow conditions and employment to replace ordinary options.
- [Removing mood and content systems reduces simulation breadth] -> Preserve their strongest themes through stress, traits, situation writing, and ending summaries.
- [A strict one-screen target can conflict with accessibility text sizing] -> Prioritize readable type and touch targets; allow scrolling only on unusually short viewports instead of shrinking controls.
- [Breaking state changes invalidate existing local saves] -> Version the storage key and start a new run when legacy state is detected.

## Migration Plan

1. Replace configuration with the reduced stats, traits, jobs, conditions, and contextual actions.
2. Replace the engine API around current situation view models and single-option dispatch.
3. Replace the document structure, renderer, and styles with the mobile single-screen shell.
4. Rewrite deterministic gameplay and balance verification for the new state machine.
5. Validate 360 by 640 and larger mobile viewports in Chromium.

Rollback consists of reverting the change set. No server-side or persistent user data migration is required.

## Open Questions

- Final numeric balance and exact situation frequency will be tuned from simulations and playtesting rather than fixed by this design.

