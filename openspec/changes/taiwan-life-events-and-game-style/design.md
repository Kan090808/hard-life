## Context

The game now has a compact 21-day, three-period loop and a minimal mobile UI. Its architecture already supports contextual situations with up to three direct options, so random events can use the same decision surface without restoring the former event-modal complexity.

## Goals / Non-Goals

**Goals:**

- Produce about two to three random events in a typical 21-day run.
- Make normal employment approximately sufficient for normal recurring costs.
- Let events create meaningful cash, energy, or stress shocks with multiple responses.
- Ground actions and writing in contemporary Taiwan life.
- Restore the earlier visual personality without breaking 360 by 640 playability.

**Non-Goals:**

- Reintroducing nested dialogs, inventories, maps, relationships, or multi-day quests.
- Simulating Taiwan prices with accounting precision.
- Guaranteeing an event on fixed calendar days.

## Decisions

### Roll events only at the start of a day

The engine checks events while preparing the morning period. A base probability of one seventh is used after a four-day minimum gap. Probability rises after seven event-free days and reaches certainty at ten days. This keeps events random but prevents clusters and long empty runs.

Alternative: independent per-period rolls. Three rolls per day would make events too frequent and harder to communicate.

### Events replace the normal situation and options

An eligible event supplies its own title, body, and two or three direct options. Resolving an option uses the existing action-result screen and advances the period normally. The event therefore costs one of the day's three decisions.

Alternative: event modal before or after an action. That adds extra decisions and violates the simplified loop.

### Separate ordinary solvency from shock resilience

Daily living cost and rent are raised, while fixed work income is reduced from the current generous values. A player who obtains and attends steady work should remain slightly cash-positive before events. Event options then demand cash, energy, stress, or a persistent problem, forcing the player to use savings or change later choices.

### Localize systems through concrete situations

Generic gigs become food delivery and convenience-store substitute shifts. Meals become bento or noodle-shop meals. Events cover scooter repairs, typhoon work disruption, NHI premiums, phone damage, family red-envelope obligations, and rental water leaks. Local flavor must remain understandable without Taiwan-specific mechanical knowledge.

### Restore visual personality through CSS, not new layout layers

The existing DOM remains single screen. Thick borders and compact offset shadows recreate the older game feel, while a cool gray-blue background, warm-white cards, and a restrained teal/coral/mustard palette keep the result minimal. Event situations receive a distinct warning treatment. Touch sizes and safe-area behavior remain unchanged.

## Risks / Trade-offs

- [Events become predictable through pity rules] -> Do not display the timer or probability.
- [Local references confuse some players] -> Use plain descriptions and show all numeric consequences.
- [Event shocks make runs impossible] -> Keep at least one non-cash response and verify multiple successful endings.
- [Bold styling causes 360px overflow] -> Preserve the current layout dimensions and test both 360x640 and 430x932.
