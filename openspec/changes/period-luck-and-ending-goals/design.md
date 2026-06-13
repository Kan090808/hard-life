## Context

The game already prepares one situation with at most three options for each morning, afternoon, and evening period. Actions currently share one broad pool and resolve mostly deterministic effects. Endings are selected by an ordered condition chain and the ending screen only shows the result earned in the current run.

## Goals / Non-Goals

**Goals:**
- Make each period strategically recognizable through exclusive ordinary action pools.
- Make luck visible and understandable without making action costs deceptive.
- Add replay goals through difficult endings and a persistent ending collection.
- Preserve the direct three-choice mobile loop and deterministic testability.

**Non-Goals:**
- Add a fourth daily decision, inventory, calendar planner, or separate event modal.
- Randomize event-response consequences a second time.
- Hide ending requirements behind secret silhouettes.

## Decisions

### Periods own explicit action pools

Each ordinary action declares its eligible periods. Morning covers planning, job search, breakfast, and administration; afternoon covers scheduled shifts, delivery, temporary work, meals, and repairs; evening covers study, freelance work, networking, walking, and sleep. Emergency debt and condition actions may override the pool in their designated practical period.

This is preferred over preference ordering because ordering still allows the same actions to appear throughout the day.

### Base effects remain reliable and luck applies a variant

Each ordinary action defines a good and bad outcome containing tailored text and an additional effect delta. The engine first applies the visible base effect, then rolls against a displayed good-outcome rate derived from luck. This preserves player agency while creating uncertainty.

Event responses remain deterministic because the event trigger is already random and doubling uncertainty would make shocks feel arbitrary.

### Luck uses bounded anti-streak adjustment

Luck starts at 50 and is bounded from 0 to 100. Most good-outcome probability is `35% + luck * 0.3`, producing a 35–65% range, while unusually competitive actions such as job search can declare a visible negative modifier. A good result reduces luck by 4 and a bad result raises it by 5. This makes luck meaningful, visible, and resistant to long streaks without guaranteeing alternation.

### Ending definitions are data-driven and ordered by rarity

All completion endings move into a shared catalog with title, body, difficulty, requirement copy, and a predicate key. Evaluation checks very difficult endings first, then difficult endings, then ordinary survival endings. Failure endings join the same display catalog.

### Discoveries persist outside run saves

The UI stores discovered ending IDs in a separate local-storage key. The ending page always displays every ending and its requirement, while discovery state and the current ending receive stronger visual treatment. Resetting a run does not clear this collection.

## Risks / Trade-offs

- [Luck overwhelms strategy] → Keep base effects fixed and cap variant effects below the base action value.
- [Exclusive pools produce fewer than two valid actions] → Add period-specific fallback actions with no affordability gate.
- [Very difficult endings are mathematically impossible] → Extend balance simulation to report ending distribution and include direct predicate tests.
- [Ending collection makes the page long] → Use compact cards and allow the ending screen to scroll; active gameplay remains one-screen.
- [Existing v4 saves lack luck fields] → Increment the run-save key and reject older saves cleanly.
