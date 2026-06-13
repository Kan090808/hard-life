## Why

The three daily decisions currently draw from nearly the same action pool, so morning, afternoon, and evening do not create distinct planning pressure. Outcomes are also too predictable, while the ending screen does not expose difficult long-term goals that encourage replay.

## What Changes

- Give morning, afternoon, and evening separate ordinary action pools grounded in Taiwan daily life.
- Add a visible luck resource that controls whether each ordinary action receives its good or bad outcome modifier.
- Keep an action's stated base cost reliable, then apply a smaller luck-based bonus or setback and adjust luck against streaks.
- Add difficult and very difficult success endings with explicit priority and achievable conditions.
- Add an ending collection to the ending screen that shows every ending, its difficulty, unlock condition, and persistent discovery state.

## Capabilities

### New Capabilities
- `period-specific-actions`: Distinct morning, afternoon, and evening action pools with contextual emergency overrides.
- `luck-based-action-outcomes`: A visible luck stat and two possible outcome variants for every ordinary action.
- `ending-goal-collection`: Tiered success endings and a persistent, fully visible ending goal collection.

### Modified Capabilities

## Impact

- Updates action, stat, and ending configuration in `src/data/config.mjs`.
- Updates option generation, action resolution, ending evaluation, and saved state in `src/game.mjs`.
- Updates the top status bar and ending renderer in `src/main.mjs`, `index.html`, and `styles.css`.
- Expands deterministic gameplay, balance, and mobile UI verification scripts.
