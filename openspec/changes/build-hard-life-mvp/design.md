## Context

This change defines the first playable web MVP for 《人生好難：在艱難的生活中存活 21 天》. The repository does not yet contain an existing game implementation, so the design should optimize for fast delivery, clarity of rules, and easy tuning of balance values. The MVP is a single-session browser game with no backend, persistence, or authentication, which means all gameplay state can live in memory and all content can be shipped as static assets.

The gameplay loop is rules-heavy rather than animation-heavy. The most important technical constraint is keeping state transitions deterministic and inspectable so that balancing and later content expansion do not require rewriting the game loop. The UI only needs to support one active day flow at a time: view status, choose an action, optionally resolve an event, then advance the day or end the run.

## Goals / Non-Goals

**Goals:**
- Deliver a complete 30-day playable loop in a static web app.
- Separate content data from game-rule logic so actions, events, and ending thresholds can be tuned without restructuring the app.
- Keep state transitions predictable with pure rule functions for action resolution, rent and living cost application, event triggers, failure checks, and ending selection.
- Support a clear single-screen UI that exposes current stats, available actions, result logs, event choices, and restart behavior.

**Non-Goals:**
- Save/load support, cloud sync, accounts, or any server-side component.
- Advanced animation, audio systems, or content pipelines beyond simple static data definitions.
- Highly dynamic job trees, relationship systems, inventory, or multi-screen navigation.
- Mobile-native packaging or monetization features.

## Decisions

### Use a client-side only architecture with vanilla HTML, CSS, and JavaScript

The MVP only needs a static deploy target and simple interaction flow. Vanilla JS avoids framework setup overhead in an empty repository and keeps the first implementation easy to host on GitHub Pages. A framework can be introduced later if the project grows, but it is unnecessary for a single-screen stateful prototype.

Alternative considered: React or Vue.
React or Vue would improve component ergonomics later, but they add build tooling and architecture choices before the core loop has been validated.

### Model the game as a single serial state machine

The game should move through a small set of phases: `ready-for-action`, `resolving-event`, `game-over`, and `completed`. Each user input transitions the state forward in a controlled sequence. This prevents invalid interactions such as taking multiple actions in one day or clicking a new action while an event is unresolved.

Alternative considered: loosely coupled UI handlers mutating state directly.
That approach is faster to start but tends to scatter rule logic and makes it harder to reason about failure timing, event timing, and day advancement.

### Store balance values and event definitions as data tables

Action effects, job-tier earnings, event pools, ending thresholds, and recurring costs should live in structured configuration objects rather than inline UI code. This allows later tuning and content additions without rewriting control flow.

Alternative considered: hardcode values inside click handlers.
That would make the first pass shorter but would quickly become fragile once the event pool and job tiers expand.

### Resolve each day in a fixed order

The rule order should be:
1. Accept one player action.
2. Apply the action result.
3. Apply daily living cost.
4. Apply rent if the new day is a rent checkpoint.
5. Check immediate failure conditions.
6. Roll and resolve a random event if eligible for the day.
7. Re-check failure conditions after event resolution.
8. Advance to the next day or complete the run on day 30.

This keeps outcomes predictable and ensures costs and failures are not accidentally skipped.

Alternative considered: trigger events before recurring costs or advance the day before event resolution.
That creates ambiguous behavior around rent timing, failure precedence, and day-based messages.

### Use weighted content only if needed later; MVP starts with uniform random eligible event selection

The proposal calls for a themed but manageable event system. Uniform selection among eligible events keeps the implementation small while still supporting condition-based variety. Weighted selection can be added later without changing the event interface.

Alternative considered: weighted event rarity from the start.
Useful for depth, but unnecessary before the core loop is proven enjoyable.

## Risks / Trade-offs

- [Balance may skew too punishing or too forgiving] → Keep all action values, event effects, and ending thresholds in editable data structures and test the first build with scripted sample runs.
- [Single-screen UI can become visually dense] → Separate status, action buttons, result log, and event panel into clearly bounded sections with only one primary interaction active at a time.
- [Event outcomes could duplicate action penalties and feel unfair] → Tag events by type and review the initial pool to ensure there is a mix of setback, recovery, and opportunity outcomes.
- [No persistence means players lose runs on refresh] → Treat restart-only flow as an explicit MVP constraint and mention it in product copy or future work, but keep the in-memory implementation simple for now.
- [Future framework migration could require refactoring] → Keep rule evaluation and content definitions framework-agnostic so only the rendering layer would need replacement later.

## Migration Plan

Because this repository appears to be starting from a blank implementation state, no production data migration is required. The rollout plan is:

1. Create the static frontend structure and game data modules.
2. Implement the rule engine and rendering flow locally.
3. Verify the 30-day loop, failure states, random events, and ending selection with manual and scripted checks.
4. Deploy as a static site.

Rollback strategy: revert to the previous static site state or remove the deployment artifact. No persistent player data is at risk.

## Open Questions

- Whether the first implementation should include all 10 to 15 events immediately or start with a smaller seed set and expand after balance testing.
- Whether the UI language should ship entirely in Traditional Chinese for theme consistency or mix Chinese UI with English code-facing labels only.
- Whether `找新工作` should consume the full day even on success in the MVP, or whether later versions may allow some follow-up effect on the same day.
