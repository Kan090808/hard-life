## ADDED Requirements

### Requirement: The game SHALL give each day a slot budget based on starting energy
At the start of each active day, the game SHALL determine how many action slots the player can use from that day's starting energy. High-energy days SHALL allow two unrestricted slots, mid-energy days SHALL allow two slots with at most one heavy action, and low-energy days SHALL allow only one slot.

#### Scenario: High-energy day allows two actions
- **WHEN** a new day begins and the player's starting energy is in the high-energy band
- **THEN** the game grants two available action slots for that day
- **THEN** the player may fill both slots with any actions whose own eligibility rules are satisfied

#### Scenario: Mid-energy day limits heavy combinations
- **WHEN** a new day begins and the player's starting energy is in the mid-energy band
- **THEN** the game grants two available action slots for that day
- **THEN** the game prevents the player from selecting a second heavy action on that day

#### Scenario: Low-energy day restricts action count
- **WHEN** a new day begins and the player's starting energy is in the low-energy band
- **THEN** the game grants one available action slot for that day
- **THEN** the day can advance after that slot is resolved or the player ends the day early

### Requirement: The game SHALL resolve actions and events within the same day before applying day-end upkeep
For each day before the run ends, the game SHALL resolve one selected action at a time, optionally resolve an interrupting random event after that action, and then return the player to the remaining-slot decision point if the day still has usable slots. The game SHALL apply daily living cost and rent at most once when the player ends the day or exhausts all usable slots.

#### Scenario: Player uses two half-day actions
- **WHEN** the player has two usable slots, selects a one-slot action, resolves any triggered event, and then selects another one-slot action
- **THEN** both actions resolve within the same day
- **THEN** daily living cost is not applied between those two actions
- **THEN** daily living cost and rent are applied once when the day is committed

#### Scenario: Full-day action ends the planning portion immediately
- **WHEN** the player selects an action whose slot cost consumes the day's remaining usable time
- **THEN** the game does not offer another action for that day after any interrupting event is resolved
- **THEN** the day proceeds to day-end upkeep and failure checks

### Requirement: The game SHALL allow the player to end a day before spending every slot
If the player still has unused slots, the game SHALL allow the player to voluntarily end the day instead of forcing another action. Ending the day early SHALL preserve the already resolved action outcomes and then proceed with the normal day-end sequence.

#### Scenario: Player stops after one action on a two-slot day
- **WHEN** the player has remaining slots after resolving an action
- **THEN** the UI presents an option to end the day without taking another action
- **THEN** choosing that option applies day-end upkeep once and advances the run if no failure condition is met

### Requirement: The game SHALL expose remaining planning capacity to the player
While a run is active, the UI SHALL show the player's remaining action slots for the current day, whether another heavy action is still allowed, and any disable reason when an action cannot fit the current day state.

#### Scenario: Action is disabled because the day cannot support it
- **WHEN** the player has one light-only slot remaining and views the action list
- **THEN** the UI marks heavy or two-slot actions as unavailable
- **THEN** the UI explains that the action does not fit the remaining day capacity
