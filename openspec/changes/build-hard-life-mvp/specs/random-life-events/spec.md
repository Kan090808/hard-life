## ADDED Requirements

### Requirement: The game SHALL roll for a random event after each daily action
After resolving the selected main action and recurring daily costs, the game SHALL evaluate whether to trigger a random event using a 35% daily trigger chance unless the run has already ended from a failure condition.

#### Scenario: Event trigger succeeds
- **WHEN** the player completes a day action, recurring costs are applied, and the random event roll falls within the trigger chance
- **THEN** the game selects one eligible event for that day
- **THEN** the game presents the event before the day can advance

#### Scenario: Event trigger is skipped after failure
- **WHEN** the player reaches a failure condition before the event phase
- **THEN** the game ends the run immediately
- **THEN** the game does not present a random event for that day

### Requirement: Events SHALL support eligibility rules and branching outcomes
Each random event SHALL define its description, option set or automatic effect, and any trigger conditions such as minimum skill, low energy, or other state requirements. The game SHALL only choose from events whose trigger conditions are currently satisfied.

#### Scenario: Conditional event becomes eligible
- **WHEN** the player has skill 50 or higher during event selection
- **THEN** the 面試邀請 event is eligible to be selected

#### Scenario: Conditional event stays ineligible
- **WHEN** the player has energy 30 or higher during event selection
- **THEN** the 身體不舒服 event is not eligible to be selected by its low-energy trigger

### Requirement: Event options SHALL apply the defined consequences
When an event offers player choices, the selected option SHALL apply its configured stat changes and any defined follow-up effects such as job outcome checks, possible schedule penalties, or itemized money loss.

#### Scenario: Player accepts a substitute shift
- **WHEN** the 主管臨時叫你代班 event is shown and the player chooses to accept
- **THEN** the game increases money by 900
- **THEN** the game decreases energy by 30
- **THEN** the game increases stress by 15

#### Scenario: Automatic money event resolves without a choice
- **WHEN** the 發票中獎 event is selected
- **THEN** the game increases money by 200
- **THEN** the game increases mood by 15
- **THEN** the game does not require an additional player choice

### Requirement: Event resolution SHALL be logged in the daily result output
The game SHALL show the player a readable summary of the main action result and any event outcome so the consequences of each day are understandable.

#### Scenario: Event result is shown after choice resolution
- **WHEN** the player finishes resolving an event with options
- **THEN** the result area includes the event title or description
- **THEN** the result area lists the applied outcome in player-facing text
