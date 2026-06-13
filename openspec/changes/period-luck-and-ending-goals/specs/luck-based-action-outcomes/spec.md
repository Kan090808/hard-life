## ADDED Requirements

### Requirement: Luck shall be visible and bounded
The game SHALL display a numeric luck resource from 0 through 100 with an explanation of its current good-outcome probability.

#### Scenario: Player opens luck information
- **WHEN** the player activates the luck status control
- **THEN** the game explains the current good-outcome probability and anti-streak adjustment

### Requirement: Every ordinary action shall have good and bad variants
Every ordinary action SHALL apply its stated base effect and then resolve exactly one tailored good or bad additional outcome using the current luck probability.

#### Scenario: Good action result
- **WHEN** the luck roll succeeds
- **THEN** the game applies the action's good modifier, displays good-result text, and lowers luck slightly

#### Scenario: Bad action result
- **WHEN** the luck roll fails
- **THEN** the game applies the action's bad modifier, displays bad-result text, and raises luck slightly

### Requirement: Event responses shall remain deterministic
Random-event response options SHALL apply their displayed effects without an additional luck roll.

#### Scenario: Player responds to a random event
- **WHEN** an event option is selected
- **THEN** only the configured event effects are applied
