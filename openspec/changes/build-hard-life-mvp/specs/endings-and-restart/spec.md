## ADDED Requirements

### Requirement: Failure conditions SHALL end the run immediately
The game SHALL end the current run as soon as any failure condition is met: money less than or equal to -3000, energy less than or equal to 0, mood less than or equal to 0, stress greater than or equal to 100, or unpaid rent count greater than or equal to 2.

#### Scenario: Debt failure occurs
- **WHEN** the player money reaches -3000 or less during day resolution
- **THEN** the game ends the run with the debt failure outcome

#### Scenario: Eviction failure occurs
- **WHEN** unpaid rent count reaches 2
- **THEN** the game ends the run with the eviction failure outcome

### Requirement: Day 30 completion SHALL evaluate a final ending
If the player reaches the end of day 30 without triggering an immediate failure ending, the game SHALL evaluate the player state and assign exactly one final ending based on the defined ending conditions.

#### Scenario: Free life ending is awarded
- **WHEN** the run reaches the end of day 30 with money at least 30000, skill at least 80, and stress at most 50
- **THEN** the game shows the 自由人生 ending

#### Scenario: Stable life ending is awarded
- **WHEN** the run reaches the end of day 30 with money at least 10000, mood at least 50, and stress at most 60, and no higher-priority ending conditions are met
- **THEN** the game shows the 穩定生活 ending

#### Scenario: Busy survival ending is awarded
- **WHEN** the run reaches the end of day 30 without any failure ending and without meeting a stronger success ending
- **THEN** the game shows the 窮忙循環 ending

### Requirement: Ending presentation SHALL explain the result and provide restart
When a run ends, the game SHALL show the ending title, a short ending description, the final player state summary, and a restart control that begins a fresh default run.

#### Scenario: Player restarts after a finished run
- **WHEN** the player activates the restart control from a game-over or completed ending screen
- **THEN** the game resets all player state to the default starting values
- **THEN** the game returns to day 1 with the action UI enabled
