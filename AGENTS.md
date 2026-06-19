# AGENTS.md

## Repository Expectations

- After making code or behavior changes, check whether smoke tests need to be updated. If they do, update and run the relevant smoke tests; if they do not, state why in the final response.

## Project Map

- `src/data/config.mjs`: Game data and balance knobs, including jobs, actions, random events, conditions, endings, costs, and period copy.
- `src/game.mjs`: Core game state and rules, including option generation, action/event outcomes, day and period progression, rent, failures, and ending evaluation.
- `src/main.mjs`: Browser UI wiring, rendering, DOM events, localStorage save/load, audio controls, analytics calls, and ending catalog display.
- `src/share.mjs`: Share-card snapshot generation and rendering.
- `scripts/verify-gameplay.mjs`: Gameplay smoke test for core rules and regression checks.
- `scripts/balance-check.mjs`: Seeded balance simulation smoke test for outcome spread and event cadence.
- `docs/`: Manual QA and balance notes.
- `openspec/`: Historical OpenSpec proposals, designs, tasks, and capability specs.
