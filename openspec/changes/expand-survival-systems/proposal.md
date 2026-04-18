## Why

The current MVP proves the core survival loop, but its one-action-per-day structure and mostly stat-only event gating flatten player choice too quickly. The next step is to make daily planning, earning money, and random events feel more like an interconnected life simulation without abandoning the existing 30-day survival format.

## What Changes

- Expand the daily loop from a single main action into a slot-based planning system that can occasionally support combinations such as working and studying on the same day.
- Add lighter-weight actions and additional money-making paths beyond standard work and overtime, including side gigs, freelance-style opportunities, and life-admin actions.
- Introduce persistent life-condition flags so events can create lasting consequences instead of resolving as isolated one-day stat swings.
- Rework random event eligibility to consider current stats, recent behavior, work state, and persistent conditions when selecting outcomes.
- Add event chains and follow-up events so choices such as delaying repairs or building contacts can affect future days in believable ways.
- Preserve the existing 30-day run structure, recurring costs, and survival theme while increasing strategic variety and internal consistency.

## Capabilities

### New Capabilities
- `time-slotted-daily-planning`: Replace the one-action day with a slot-based day structure, action intensity rules, and energy-based limits on how many actions the player can combine.
- `diverse-income-and-life-admin`: Add non-job income actions and utility actions such as side gigs, freelance work, and handling practical life problems that compete for time.
- `stateful-random-events`: Add persistent condition flags, state-aware event eligibility, and multi-day event consequences that make random events respond to the player's situation.

### Modified Capabilities

None.

## Impact

- Affects the core state model in [src/game.mjs](/Users/kan/Documents/hard-life/src/game.mjs), especially daily phase resolution, action availability, and event follow-up handling.
- Affects balance and content definitions in [src/data/config.mjs](/Users/kan/Documents/hard-life/src/data/config.mjs) and [src/data/events.mjs](/Users/kan/Documents/hard-life/src/data/events.mjs).
- Requires UI updates in [src/main.mjs](/Users/kan/Documents/hard-life/src/main.mjs), [index.html](/Users/kan/Documents/hard-life/index.html), and [styles.css](/Users/kan/Documents/hard-life/styles.css) to communicate slots, action weight, persistent conditions, and chained event outcomes.
- Expands verification scope for balance checks and manual playtesting because the number of valid daily combinations and event branches increases substantially.
