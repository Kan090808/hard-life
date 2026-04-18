## ADDED Requirements

### Requirement: Event selection SHALL consider stats, recent behavior, and persistent conditions
When the game evaluates random events, it SHALL choose only from events whose trigger rules match the player's current stats, current job context, recent-action history, and persistent life-condition flags. Event definitions SHALL be able to express eligibility based on any combination of those inputs.

#### Scenario: Overwork history unlocks a health warning event
- **WHEN** the player has recently stacked multiple heavy-work actions and carries elevated burnout risk
- **THEN** a health-related event that depends on that recent behavior becomes eligible

#### Scenario: Event remains unavailable without the required condition
- **WHEN** the player does not have the condition, history, or stat state required by an event
- **THEN** that event is excluded from the day's eligible event pool

### Requirement: Events SHALL be able to create lasting consequences through condition flags
Random event outcomes SHALL be able to set, clear, or worsen persistent condition flags that remain active across future days until another action or event changes them. Those flags SHALL affect later action availability, action cost, event eligibility, or related follow-up outcomes.

#### Scenario: Scooter breakdown creates a persistent penalty
- **WHEN** the player resolves an event that leaves the scooter in a broken state
- **THEN** the game records a persistent transport problem instead of resolving the issue entirely within the same day
- **THEN** later commute-dependent actions or events can react to that condition until it is fixed

#### Scenario: Repair action clears the persistent penalty
- **WHEN** the player later uses the appropriate life-admin response to fix the transport problem
- **THEN** the broken-scooter condition is removed
- **THEN** the related action or event penalties no longer apply on later days

### Requirement: The event system SHALL support follow-up opportunities and setbacks
An event outcome SHALL be allowed to schedule or enable future events that logically follow from the player's earlier choice. The follow-up system SHALL support both negative chains such as neglected repairs and positive chains such as referrals, introductions, or returning clients.

#### Scenario: Opportunity event creates a future freelance lead
- **WHEN** the player takes an event outcome that establishes a useful contact
- **THEN** the game can mark a future opportunity flag or follow-up hook
- **THEN** a later freelance or referral event can become eligible because of that earlier choice

#### Scenario: Neglected problem creates a future complication
- **WHEN** the player chooses to delay solving an active practical problem
- **THEN** the game can enable a future complication event tied to that neglected issue

### Requirement: The UI SHALL explain active conditions and event consequences clearly
The game SHALL present active persistent conditions to the player and SHALL describe when an event outcome created or removed an ongoing effect. Event logs SHALL distinguish between immediate stat changes and longer-term consequences.

#### Scenario: Event log reports an ongoing condition
- **WHEN** an event outcome applies a persistent condition instead of only changing stats
- **THEN** the result output states that the condition will continue affecting later days
- **THEN** the status UI reflects that active condition before the next planning decision
