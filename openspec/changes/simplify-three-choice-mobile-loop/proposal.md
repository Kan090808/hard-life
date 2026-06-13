## Why

The current game exposes a broad action catalog, nested work and event choices, optional day-ending controls, and a dashboard-like status interface. That creates more planning and interface overhead than meaningful tension, especially on a phone where the intended experience should be three quick, consequential decisions per day.

## What Changes

- **BREAKING** Replace the free-form daily planner with a fixed morning, afternoon, and evening sequence. Each period presents at most three valid actions and advances immediately after one choice.
- **BREAKING** Remove manual sleep, zero-time actions, repeat-action planning, daily attendance prompts, nested gig selection, and separate event-choice interruptions from the normal loop.
- Simplify employment to unemployed, part-time, and full-time states. Job search and going to work become ordinary period actions; freelance work becomes an occasional unlocked action rather than a separate job tier.
- Reduce the always-visible survival model to money, energy, stress, and skill. Character rolls become one passive trait, while mood and secondary character attributes no longer require separate management.
- Simplify rent and persistent problems so they directly affect upcoming choices without introducing separate landlord or project-management subsystems.
- Replace the current expandable dashboard and modal-heavy action flow with a mobile-first single-screen interface containing a compact icon status bar, one current situation, and three large action buttons.
- Let players tap status icons for short explanations in a bottom sheet without expanding or rearranging the main layout.
- Shorten the run to 21 days so the fixed three-choice cadence remains suitable for a short mobile session.

## Capabilities

### New Capabilities

- `three-choice-daily-loop`: Covers the fixed morning, afternoon, and evening decision sequence, contextual option selection, automatic day settlement, and compact result transitions.
- `simplified-survival-economy`: Covers the reduced core stats, employment progression, rent pressure, passive traits, freelance opportunities, and limited persistent problems.
- `mobile-single-screen-interface`: Covers the no-fold mobile layout, tappable icon status bar, contextual situation presentation, large action targets, bottom-sheet explanations, and small-screen viewport requirements.

### Modified Capabilities

None.

## Impact

- Replaces most gameplay flow and state behavior in `src/game.mjs` and configuration in `src/data/config.mjs`.
- Replaces the main rendering and interaction model in `src/main.mjs`, `index.html`, and `styles.css`.
- Retires the current nested event and action presentation; existing event content may be reused only where it fits the new contextual-option model.
- Requires gameplay verification, balance simulation, and mobile browser smoke tests to be rewritten around the fixed three-period loop.
