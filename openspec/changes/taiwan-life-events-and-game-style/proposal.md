## Why

The simplified three-choice loop is clear but currently feels visually generic, economically predictable, and disconnected from everyday life in Taiwan. The game needs scarce disruptive events and stronger local texture so ordinary days feel barely manageable while occasional bad luck creates the real survival tension.

## What Changes

- Restore the earlier playful game presentation with thick dark borders, compact offset shadows, restrained functional colors, and bolder typography while preserving the current mobile single-screen structure.
- Add rare contextual random events that replace one normal period decision instead of opening a separate modal.
- Target roughly one random event per seven days using a daily morning roll, a minimum gap, and overdue protection against excessively long event droughts.
- Rebalance normal income and recurring costs so steady work can narrowly cover ordinary life, while event costs are difficult but recoverable.
- Rewrite regular actions, jobs, situations, and event stories around recognizable Taiwan life such as convenience-store shifts, food delivery, bento meals, scooters, typhoons, National Health Insurance bills, family red envelopes, and rental repairs.
- Track event frequency and outcomes in deterministic verification and balance simulations.

## Capabilities

### New Capabilities

- `taiwan-contextual-events`: Rare Taiwan-life random events, cadence rules, contextual event options, and event outcome tracking.
- `playful-mobile-game-style`: A simplified game presentation with a cool neutral background, warm-white cards, and limited functional accent colors applied to the existing one-screen mobile UI.

### Modified Capabilities

None.

## Impact

- Extends `src/data/config.mjs` with event definitions and localized content.
- Extends `src/game.mjs` state, situation generation, option resolution, and summaries.
- Retunes economy values used by gameplay and balance scripts.
- Restyles `styles.css` and lightly annotates rendered event states in `src/main.mjs`.
- Updates gameplay, balance, and browser smoke verification.
