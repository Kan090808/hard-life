## ADDED Requirements

### Requirement: The active game shall use one mobile-first screen
The active game interface SHALL contain a compact header, tappable status bar, current situation, and current action choices in one single-column shell. It SHALL NOT require expanding or collapsing sections to access normal gameplay information.

#### Scenario: Game renders at the reference viewport
- **WHEN** the active game is displayed at 360 by 640 CSS pixels with default text sizing
- **THEN** the header, status bar, situation, and all current action choices are visible without horizontal scrolling
- **THEN** normal gameplay does not depend on a fold or details toggle

### Requirement: Primary status shall use icons and numbers
The interface SHALL permanently display money, energy, stress, skill, and employment or trait context using consistent SVG icons and concise values. It SHALL provide accessible names independent of the icons.

#### Scenario: Screen reader reads status
- **WHEN** assistive technology focuses a status control
- **THEN** it receives the status name, current value, and button role

### Requirement: Status controls shall open concise explanations
Tapping a status item SHALL open a bottom sheet that explains the metric, current value, and important threshold or modifier. Closing the sheet SHALL return focus to the originating status control without changing gameplay state.

#### Scenario: Player taps energy
- **WHEN** the player taps the energy status item
- **THEN** a bottom sheet explains energy and its failure threshold
- **THEN** no main-layout section expands or moves permanently

### Requirement: Current actions shall be large direct controls
Each displayed action SHALL be a full-width control with a minimum touch target height of 56 CSS pixels, an action name, and a concise effect preview. Adjacent controls SHALL have at least 8 CSS pixels of separation.

#### Scenario: Player views three actions on a phone
- **WHEN** three current actions are available
- **THEN** all three are independently tappable without relying on hover
- **THEN** each control communicates the expected trade-off before selection

### Requirement: Secondary controls shall not compete with gameplay
Reset, sound, and other utility controls SHALL be visually subordinate and SHALL NOT occupy one of the current action positions. Destructive reset SHALL require confirmation.

#### Scenario: Player opens utility menu
- **WHEN** the player activates the utility control
- **THEN** sound and reset controls are available outside the action list
- **THEN** choosing reset requires an explicit confirmation before the run is discarded

### Requirement: The interface shall respect mobile safe areas and accessibility preferences
The game shell SHALL account for top and bottom safe-area insets, visible keyboard focus, reduced-motion preferences, and touch interaction without hover dependency.

#### Scenario: Device has a bottom safe area
- **WHEN** the browser reports a nonzero bottom safe-area inset
- **THEN** the final action control remains clear of the obstructed region
