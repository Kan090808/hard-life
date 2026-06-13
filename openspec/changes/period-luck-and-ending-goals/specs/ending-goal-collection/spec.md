## ADDED Requirements

### Requirement: Completion endings shall include tiered goals
The game SHALL include ordinary, difficult, and very difficult completion endings and evaluate more difficult ending conditions before easier fallback endings.

#### Scenario: Multiple ending conditions are satisfied
- **WHEN** a completed run satisfies both a difficult ending and an ordinary ending
- **THEN** the difficult ending is awarded

### Requirement: Ending screen shall show the full collection
The ending screen SHALL list every success and failure ending with its title, difficulty, requirement, and discovered state.

#### Scenario: Player finishes a run
- **WHEN** any ending screen is shown
- **THEN** the current ending is recorded as discovered and all ending goals remain visible

### Requirement: Ending discoveries shall persist across runs
Discovered ending IDs SHALL be stored independently from the active run save and SHALL survive restart actions.

#### Scenario: Player restarts after discovering an ending
- **WHEN** the player begins another run and later reaches an ending screen
- **THEN** previously discovered endings remain marked as discovered
