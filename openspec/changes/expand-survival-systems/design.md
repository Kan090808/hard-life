## Context

The current MVP models each day as a single action followed by upkeep, failure checks, and at most one random event. That structure keeps implementation simple, but it also creates three visible product limits: the player cannot combine believable same-day activities, earning money is too concentrated in standard work actions, and event outcomes often feel disconnected from later days because the state model does not retain enough context.

This change keeps the existing 30-day browser format and data-driven rule engine, but extends the model so daily planning, utility actions, and random events can interact through persistent state. The implementation still needs to stay deterministic and inspectable because balance tuning remains more important than content volume.

## Goals / Non-Goals

**Goals:**
- Support a slot-based day flow that can resolve more than one action before the day advances.
- Add new action types that create alternative income and non-income tradeoffs without removing the survival pressure.
- Introduce persistent condition flags and recent-history tracking so event selection can respond to the player's lived situation.
- Keep actions and events data-driven so later tuning remains mostly content work rather than engine rewrites.
- Preserve the current single-screen UI model and 30-day session structure.

**Non-Goals:**
- Building a full inventory, relationship, or map system.
- Turning the game into an open-ended sandbox with unlimited daily actions.
- Adding save/load, backend systems, or account-linked progression.
- Fully rebalancing every numeric value in this design phase; the change defines the system shape first.

## Decisions

### Model each day as a slot budget with an explicit end-of-day commit

Each day starts with a slot budget derived from the player's starting energy. The player can spend those slots across multiple actions, optionally stop early, and then commit the day once no more useful actions remain. Day-end upkeep such as living cost and rent is applied once per day after the player finishes acting, not after every slot action.

This preserves the monthly survival cadence while allowing combinations like work plus study. It is simpler than a free-form action point system because the maximum schedule size remains small and inspectable.

Alternative considered: always allow exactly two actions per day.
That would create the desired combo play, but it would ignore fatigue and make the system feel disconnected from the player's physical condition.

### Represent actions with time weight, intensity, and gating metadata

The action catalog should remain data-driven, but actions now need richer metadata than flat stat deltas. Each action definition should include at least slot cost, intensity class, category, and any eligibility rule tied to conditions, skill, or recent history. Full-day actions such as standard work can consume both slots, while lighter actions such as study or errands consume one slot.

This lets the engine answer rule questions consistently: which actions fit the remaining day, which actions are too heavy for a low-energy start, and which actions are unlocked by stateful opportunities.

Alternative considered: hardcode slot behavior in game logic for each action.
That would be faster once, but it would make future content additions fragile and repetitive.

### Add persistent condition flags and recent-history counters to the core state

The state model should add a small, explicit set of durable condition flags and short-horizon behavior counters. Condition flags cover things such as broken transport, broken devices, current burnout risk, landlord tension, or freelance contacts. Recent-history counters cover patterns such as consecutive heavy-work days or days since the last rest action.

This gives event selection a grounded basis and lets action consequences matter beyond same-day stat changes. It is intentionally lighter than a full inventory or narrative quest system.

Alternative considered: encode all follow-up logic as raw stat thresholds only.
That keeps the state small, but it cannot express why a specific consequence should continue to matter tomorrow.

### Resolve random events between slot actions and before day-end upkeep is committed

Events should still interrupt the day rather than only appear after the day is fully over. After each chosen action, the game can trigger and resolve an event before the player chooses another action or ends the day. Once the player commits the day, recurring costs and rent are applied exactly once, followed by failure checks and day advancement.

This keeps events responsive to the action that just happened and allows follow-up events to change what the player does with their remaining time. It also avoids double-charging upkeep when a player uses two half-day actions.

Alternative considered: move all events to the very end of the day.
That would simplify sequencing, but it would remove the interesting case where an event changes the player's remaining plan for the same day.

### Use layered event eligibility instead of one flat random pool

Event selection should first filter for eligibility, then prioritize more state-specific events over generic ambient ones. A practical structure is to group events into urgent-condition, state-response, opportunity, and ambient layers, choosing from the highest-priority non-empty layer. Follow-up events can reference flags or cooldown markers set by earlier outcomes.

This improves narrative logic without requiring a complex weighted-probability system. It makes the world feel more responsive when a broken scooter or new freelance contact meaningfully changes what kinds of events can happen next.

Alternative considered: keep uniform random selection across all eligible events.
That remains easy to implement, but it is the main reason current events can feel arbitrary.

## Risks / Trade-offs

- [The action planner could become harder to read] → Keep the maximum daily schedule small, expose remaining slots clearly, and show why actions are disabled.
- [Persistent flags can sprawl into an unmaintainable mini-RPG] → Start with a short curated flag list and require each flag to affect at least one action or future event.
- [Dominant combo patterns may emerge, such as always work plus study] → Use action intensity limits, conditional gating, and balance verification to prevent one universal best route.
- [Event chains may feel punitive if they only accumulate downside] → Ensure the follow-up system also supports opportunities, referrals, and recoverable problems.
- [End-of-day sequencing changes may break current assumptions] → Update the game loop and verification scripts together so daily cost and rent application remain testable.

## Migration Plan

1. Extend the state and config data model with slots, action metadata, condition flags, and recent-history fields.
2. Update the game loop to support repeated action selection within a day, mid-day event interruption, and an explicit end-of-day commit step.
3. Expand the action catalog and event definitions to use the new metadata and stateful outcomes.
4. Update the UI to show remaining slots, action weight, disabled reasons, and active condition indicators.
5. Refresh manual verification and scripted balance checks around multi-action days, persistent-condition scenarios, and event-chain behavior.

Rollback strategy: revert the change set and restore the previous one-action daily loop. No persistent player data migration is required because runs are in-memory only.

## Open Questions

- Which exact energy thresholds should gate unrestricted two-slot days versus limited two-slot days in the first implementation?
- Which initial persistent condition flags are the minimum useful set for launch without overcomplicating balance?
- Whether all legacy actions should survive unchanged in the expanded action list, or whether one or two should be replaced by more systemic utility actions.
