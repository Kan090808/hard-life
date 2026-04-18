## ADDED Requirements

### Requirement: The game SHALL provide six main daily actions
On each active day, the player SHALL be able to choose exactly one of the following actions: 去打工, 加班, 休息, 學技能, 找新工作, and 犒賞自己.

#### Scenario: Action list is shown for an active day
- **WHEN** the player is ready to choose a main action
- **THEN** the UI presents all six main actions
- **THEN** selecting one action consumes the player’s main action for that day

### Requirement: Core actions SHALL apply their defined stat changes
The game SHALL apply the configured base effects for work, overtime, rest, study, and reward actions using the MVP values defined for money, energy, mood, stress, and skill.

#### Scenario: Player chooses to work
- **WHEN** the player selects 去打工 at job level 1
- **THEN** the game increases money by 800
- **THEN** the game decreases energy by 25
- **THEN** the game decreases mood by 8
- **THEN** the game increases stress by 8

#### Scenario: Player chooses to rest
- **WHEN** the player selects 休息
- **THEN** the game decreases money by 100
- **THEN** the game increases energy by 35
- **THEN** the game increases mood by 10
- **THEN** the game decreases stress by 15

#### Scenario: Player chooses to study
- **WHEN** the player selects 學技能
- **THEN** the game decreases money by 400
- **THEN** the game decreases energy by 18
- **THEN** the game decreases mood by 5
- **THEN** the game increases stress by 5
- **THEN** the game increases skill by 12

### Requirement: Job tier SHALL affect work and overtime income
The game SHALL track a job tier from level 1 to level 4 and SHALL use the tier-specific income values when resolving 去打工 and 加班.

#### Scenario: Higher-tier work pays more
- **WHEN** the player has reached job level 2 and selects 去打工
- **THEN** the game uses 1100 as the work income for that action

#### Scenario: Higher-tier overtime pays more
- **WHEN** the player has reached job level 3 and selects 加班
- **THEN** the game uses 2200 as the overtime income for that action

#### Scenario: Remote freelancer tier does not use normal overtime
- **WHEN** the player has reached job level 4
- **THEN** the game does not present the level 1 to 3 overtime income behavior unchanged
- **THEN** the implementation either disables 加班 or replaces it with the level-4 urgent-job variant defined by the UI copy

### Requirement: Finding a new job SHALL use skill-gated probabilistic progression
The game SHALL resolve 找新工作 using the success rate formula `20% + skill × 0.8%`, capped so the result does not exceed 100%, and SHALL only upgrade the player to the highest job tier whose unlock conditions are satisfied.

#### Scenario: Job search fails
- **WHEN** the player selects 找新工作 and the success roll fails
- **THEN** the game decreases energy by 15
- **THEN** the game decreases mood by 15
- **THEN** the game increases stress by 10
- **THEN** the player job tier does not increase

#### Scenario: Job search upgrades to level 2
- **WHEN** the player selects 找新工作, the success roll succeeds, and skill is at least 30
- **THEN** the player advances to at least job level 2

#### Scenario: Job search upgrades to level 4 only when all conditions are met
- **WHEN** the player selects 找新工作, the success roll succeeds, skill is at least 80, and money is at least 10000
- **THEN** the player can advance to job level 4

### Requirement: Low-energy overtime SHALL carry burnout risk
If the player selects 加班 while energy is below 25, the game SHALL evaluate an overwork event risk that can apply the additional overtime penalty.

#### Scenario: Overtime triggers overwork penalty
- **WHEN** the player selects 加班 with energy below 25 and the overwork risk triggers
- **THEN** the game decreases energy by an additional 20
- **THEN** the game increases stress by an additional 20
