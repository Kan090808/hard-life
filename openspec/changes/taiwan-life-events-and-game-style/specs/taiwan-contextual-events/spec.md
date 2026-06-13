## ADDED Requirements

### Requirement: Random events shall be rare and separated
The game SHALL evaluate random events only for the morning period. Two random events SHALL NOT occur fewer than four settled days apart, and the event probability SHALL increase when no event has occurred for more than seven days.

#### Scenario: Recent event prevents another event
- **WHEN** fewer than four days have passed since the previous random event
- **THEN** the morning uses a normal situation without rolling another random event

#### Scenario: Event drought ends
- **WHEN** ten days have passed since the previous event or run start
- **THEN** the next eligible morning presents a random event

### Requirement: Random events shall use the normal period decision
An active random event SHALL replace the current situation and provide two or three direct options. Selecting one event option SHALL resolve the event and consume the current period without opening a separate event dialog.

#### Scenario: Player handles an event
- **WHEN** the player selects an event response
- **THEN** the listed effects are applied immediately
- **THEN** the result screen identifies the event outcome
- **THEN** continuing advances to the afternoon period

### Requirement: Event options shall include difficult trade-offs
Each negative event SHALL offer at least one cash response and at least one non-cash or deferred-cost response. Event consequences SHALL be significant relative to normal daily income.

#### Scenario: Player cannot afford the safest response
- **WHEN** the player lacks the cash required by an event option
- **THEN** that option is omitted
- **THEN** at least one valid non-cash response remains available

### Requirement: Events and regular actions shall reflect Taiwan life
The action and event catalog SHALL use recognizable Taiwan settings, services, prices, and everyday language while keeping effects understandable from their previews.

#### Scenario: Player views an ordinary period
- **WHEN** contextual options are generated
- **THEN** income, food, transport, work, or social options use concrete Taiwan-life wording rather than generic placeholders

### Requirement: The game shall track event cadence
State and run summaries SHALL record the most recent event day, total triggered events, and event identifiers.

#### Scenario: Event resolves
- **WHEN** the player chooses an event response
- **THEN** the event count increments exactly once
- **THEN** the resolved event identifier is retained in run history

