## 1. Project Setup

- [x] 1.1 Create the static frontend entry files and folder structure for HTML, CSS, JavaScript, and game content data.
- [x] 1.2 Add a single source of truth for default player state, recurring costs, ending thresholds, and job-tier income values.
- [x] 1.3 Define structured content modules for the six actions and the initial random event pool in Traditional Chinese copy.

## 2. Core Game Engine

- [x] 2.1 Implement the in-memory game state model with explicit phases for ready-for-action, resolving-event, game-over, and completed.
- [x] 2.2 Implement the per-day resolution pipeline for action effects, daily living cost, rent checkpoints, failure checks, event trigger checks, and day advancement.
- [x] 2.3 Implement reusable stat update helpers that clamp or validate state transitions consistently across actions, events, and endings.

## 3. Actions And Job Progression

- [x] 3.1 Implement resolution logic for 去打工, 加班, 休息, 學技能, 找新工作, and 犒賞自己 using the MVP balance values.
- [x] 3.2 Implement job-tier progression rules, tier-specific work income, and the level-4 behavior that disables standard overtime.
- [x] 3.3 Implement the 找新工作 success-rate calculation, unlock-condition checks, and failure penalties.
- [x] 3.4 Implement the low-energy overtime overwork risk and apply the additional penalty when the risk triggers.

## 4. Random Events

- [x] 4.1 Implement random event triggering with a 35 percent daily chance that runs only after action and recurring-cost resolution when the run is still active.
- [x] 4.2 Implement event eligibility filtering based on player state conditions such as low energy or minimum skill.
- [x] 4.3 Implement event choice resolution and automatic event outcomes, including result log entries for all applied effects.

## 5. Endings And Restart

- [x] 5.1 Implement immediate failure ending detection for debt, collapse, burnout, hopelessness, and eviction.
- [x] 5.2 Implement day-30 ending evaluation with a single-ending priority order and matching ending copy.
- [x] 5.3 Implement the restart flow so a finished run resets back to the default starting state.

## 6. UI And Verification

- [x] 6.1 Build the single-screen UI for status display, rent countdown, current job, action buttons, daily result log, event choices, and ending summary.
- [x] 6.2 Disable invalid interactions so the player cannot take multiple actions in one day or act while an event is unresolved or the run is over.
- [x] 6.3 Add manual verification coverage for the 30-day loop, rent failures, random event resolution, job upgrades, ending selection, and restart behavior.
- [x] 6.4 Run balance passes on the initial event and action values, then adjust content data if the MVP is trivially easy or unfairly punishing.
