## ADDED Requirements

### Requirement: Ordinary actions shall belong to explicit periods
The game SHALL generate ordinary actions only during their configured morning, afternoon, or evening periods.

#### Scenario: Morning options are prepared
- **WHEN** a normal morning period is prepared
- **THEN** the ordinary options contain planning, job-search, breakfast, or administration actions and exclude afternoon and evening ordinary actions

#### Scenario: Evening options are prepared
- **WHEN** a normal evening period is prepared
- **THEN** the ordinary options contain recovery, study, networking, or freelance actions and exclude morning and afternoon ordinary actions

### Requirement: Every period shall retain valid choices
The game SHALL provide between two and three affordable or no-cost choices in every normal period after contextual work, debt, and condition options are applied.

#### Scenario: Player has no money in an ordinary period
- **WHEN** paid options are unaffordable
- **THEN** the period still presents at least two valid actions
