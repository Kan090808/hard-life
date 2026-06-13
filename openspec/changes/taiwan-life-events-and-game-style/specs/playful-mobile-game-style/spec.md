## ADDED Requirements

### Requirement: The interface shall use the established playful game style
The mobile game SHALL use a cool neutral background, warm-white surfaces, bold dark outlines, compact offset shadows, restrained functional colors, and game-like labels rather than a flat dashboard or a saturated full-page background.

#### Scenario: Active game renders
- **WHEN** the player enters an ordinary decision period
- **THEN** status items, situation panel, and action buttons have visible outlined card treatment and distinct color roles

### Requirement: Event situations shall be visually distinct
An active random event SHALL display a warning treatment that is distinguishable through text and decoration, not color alone.

#### Scenario: Random event appears
- **WHEN** the current situation is an event
- **THEN** the situation includes an event label and stronger warning styling

### Requirement: Restyled gameplay shall remain mobile complete
The visual changes SHALL preserve full interaction at 360 by 640 CSS pixels, 56-pixel action targets, safe-area padding, and no horizontal overflow.

#### Scenario: Small phone renders three actions
- **WHEN** the interface is displayed at 360 by 640 CSS pixels
- **THEN** all current actions remain visible and independently tappable
- **THEN** the page does not overflow horizontally
