## ADDED Requirements

### Requirement: The game shall use four mutable survival resources
The active run SHALL track money, energy, stress, and skill as its mutable player resources. Energy and stress SHALL be bounded from 0 to 100, and resource changes SHALL be visible in option previews and results.

#### Scenario: Action changes resources
- **WHEN** the player views and selects an action
- **THEN** the action preview identifies its deterministic resource changes or a concise range
- **THEN** the result reports the actual changes applied

### Requirement: Each run shall have one passive trait
At run creation, the game SHALL assign one named passive trait. The trait SHALL provide one understandable starting or recurring modifier and SHALL be available through status explanation without adding another mutable resource.

#### Scenario: Player inspects the trait
- **WHEN** the player taps the trait status control
- **THEN** the game explains its exact gameplay modifier

### Requirement: Employment shall use three states
Employment SHALL be limited to unemployed, part-time, and full-time. Job search SHALL be a period action that can advance employment by one state, and scheduled work SHALL appear as an ordinary contextual period action.

#### Scenario: Unemployed player finds work
- **WHEN** an unemployed player selects job search and succeeds
- **THEN** employment changes directly to part-time
- **THEN** no separate acceptance decision is required

#### Scenario: Employed player goes to work
- **WHEN** an employed player selects the work action
- **THEN** the game applies that job's income and costs immediately

### Requirement: Missing scheduled work shall use a compact consequence
When an employed player reaches a scheduled work period and chooses another action, the game SHALL record an absence. Repeated absences SHALL cause a warning or employment loss without opening a separate attendance workflow.

#### Scenario: Player repeatedly misses work
- **WHEN** the player's absence count reaches the configured limit
- **THEN** the game removes or reduces the player's employment state
- **THEN** the consequence appears in the inline result or next situation

### Requirement: Freelance work shall be an occasional action
Freelance work SHALL appear only when skill or a temporary opportunity meets its eligibility rule. Resolving freelance work SHALL produce an immediate outcome and SHALL NOT create a multi-day project state.

#### Scenario: Skilled player receives freelance option
- **WHEN** the player's skill meets the freelance threshold and the contextual roll selects an opportunity
- **THEN** freelance work may appear as one of the current period's actions
- **THEN** choosing it resolves within that period

### Requirement: Rent shall create direct survival pressure
Rent SHALL be due at configured day boundaries and SHALL be paid automatically when affordable. Unpaid rent SHALL become one debt value, and unresolved debt at a later rent boundary SHALL end the run.

#### Scenario: Player cannot pay rent
- **WHEN** rent is due and the player has insufficient money
- **THEN** the unpaid amount becomes rent debt
- **THEN** upcoming situations communicate the debt pressure without adding a landlord-management meter

### Requirement: Persistent problems shall remain limited and actionable
The game SHALL support no more than two simultaneous persistent problems. Every active problem SHALL either modify current effects or inject a relevant response action into an upcoming period.

#### Scenario: Player has a broken device
- **WHEN** a device problem is active
- **THEN** relevant work or study effects reflect the problem
- **THEN** a repair or workaround action can appear in a subsequent period

