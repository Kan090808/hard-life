## Why

The project needs a tightly scoped first playable version of 《打工人生：月底前活下去》 so the core decision loop can be validated before investing in content-heavy or system-heavy expansions. The immediate opportunity is to turn the proposal into a concrete MVP contract that defines the game rules, player-facing behaviors, and implementation boundaries for a static web release.

## What Changes

- Introduce a 30-day single-player survival game loop for the web with daily actions, automatic upkeep costs, random events, failure checks, and a final ending summary.
- Define the player state model for money, energy, mood, stress, skill, job level, unpaid rent count, and day progression.
- Add six core player actions with deterministic stat changes and job-tier-aware earnings.
- Add recurring rent and daily living cost rules that create time pressure and loss conditions.
- Add random event resolution with conditional triggers, branching choices, and stat outcomes.
- Add ending evaluation logic for multiple success and failure outcomes plus a restart flow.
- Establish the MVP scope as a client-side web game with no accounts, persistence, leaderboard, or backend services.

## Capabilities

### New Capabilities
- `daily-survival-loop`: Run a 30-day turn-based game flow with state display, action resolution, upkeep costs, event checks, failure checks, and day advancement.
- `player-actions-and-jobs`: Provide six daily actions, stat updates, job progression, and job-dependent income rules that shape player strategy.
- `random-life-events`: Trigger themed random events with conditional availability, player choices, and branching consequences.
- `endings-and-restart`: Evaluate failure and day-30 ending outcomes, present result text, and allow the player to restart a new run.

### Modified Capabilities

None.

## Impact

- Creates a new OpenSpec change set for the game MVP requirements and implementation plan.
- Affects the future frontend code for UI rendering, state management, random event data, rules evaluation, and ending selection.
- Keeps deployment simple by targeting a static web app with HTML, CSS, and JavaScript only.
