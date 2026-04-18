## ADDED Requirements

### Requirement: Game session initializes with the default survival state
The game SHALL start each new session with a 30-day run, default player stats, the base job tier, zero unpaid rent strikes, and an active state that allows exactly one main action for the current day.

#### Scenario: Player starts a new session
- **WHEN** the player opens the game for the first time or begins a new run
- **THEN** the game shows day 1 of 30
- **THEN** money is 3000, energy is 80, mood is 60, stress is 20, and skill is 0
- **THEN** the current job tier is level 1
- **THEN** unpaid rent count is 0
- **THEN** the player can choose one daily action

### Requirement: The game SHALL resolve each day through a fixed turn sequence
For each day before the run ends, the game SHALL resolve one selected daily action, apply recurring costs, evaluate failure conditions, optionally resolve a random event, and then advance the day state without allowing extra main actions for the same day.

#### Scenario: Player completes a normal day with no event
- **WHEN** the player selects one main action on an active day and no random event is triggered
- **THEN** the game applies the action effects once
- **THEN** the game applies the daily living cost once for that day
- **THEN** the game evaluates rent if the day is a rent checkpoint
- **THEN** the game checks failure conditions before advancing
- **THEN** the game advances to the next day if the run has not ended

#### Scenario: Player completes a day with an event
- **WHEN** the player selects one main action on an active day and a random event is triggered
- **THEN** the game pauses further day advancement until the event choice or automatic event outcome is resolved
- **THEN** the game applies the event outcome before ending the day
- **THEN** the game re-checks failure conditions after the event outcome
- **THEN** the game advances only if no failure condition is met

### Requirement: Recurring costs SHALL create ongoing survival pressure
The game SHALL subtract 150 money as a daily living cost every day and SHALL attempt to collect 3000 money in rent on days 7, 14, 21, and 28.

#### Scenario: Rent is paid successfully
- **WHEN** a rent checkpoint is reached and the player has enough money to pay 3000
- **THEN** the game subtracts 3000 money
- **THEN** unpaid rent count does not increase

#### Scenario: Rent cannot be paid
- **WHEN** a rent checkpoint is reached and the player does not have enough money to pay 3000
- **THEN** the game increases stress by 30
- **THEN** the game decreases mood by 20
- **THEN** the game increases unpaid rent count by 1

### Requirement: The game SHALL expose the current survival state to the player
The game SHALL display the current day, total days, money, energy, mood, stress, skill, current job tier, and time remaining until the next rent payment while a run is active.

#### Scenario: Status panel updates after a turn
- **WHEN** the player finishes resolving a day
- **THEN** the UI shows the updated stats for the next decision point
- **THEN** the UI reflects the current job tier
- **THEN** the UI shows the updated countdown to the next rent checkpoint
