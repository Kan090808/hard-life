## 1. State And Configuration

- [x] 1.1 Extend the default game state with daily slot data, persistent condition flags, and recent-history counters.
- [x] 1.2 Add slot cost, intensity, category, and eligibility metadata to the action configuration model.
- [x] 1.3 Define the initial persistent condition set and supporting helper constants for condition-aware rules.

## 2. Daily Planning Loop

- [x] 2.1 Update the game engine to initialize each day with slot capacity derived from starting energy.
- [x] 2.2 Implement repeated in-day action resolution, including remaining-slot tracking and heavy-action limits.
- [x] 2.3 Add an explicit end-day action that commits upkeep, rent, failure checks, and day advancement exactly once per day.

## 3. Expanded Actions And Economy

- [x] 3.1 Add the new side-gig, freelance-style, life-admin, and social/opportunity-building actions to the data model.
- [x] 3.2 Implement gating and outcome rules for side income actions so they differ from standard work and overtime.
- [x] 3.3 Implement utility-action outcomes that can clear active problems or create future opportunity flags without bypassing the slot budget.

## 4. Stateful Events

- [x] 4.1 Extend event definitions to support conditions, recent-history checks, and follow-up hooks.
- [x] 4.2 Update event selection logic to prioritize state-specific eligible events over generic ambient events.
- [x] 4.3 Implement event outcomes that set, clear, or worsen persistent conditions and surface those changes in the result log.

## 5. UI And Verification

- [x] 5.1 Update the UI to show remaining slots, action weight, action disable reasons, and active persistent conditions.
- [x] 5.2 Update the interaction flow so players can take multiple actions in one day, stop early, and resolve mid-day events cleanly.
- [x] 5.3 Expand manual verification and scripted balance checks for multi-action days, persistent-condition penalties, and event-chain scenarios.
