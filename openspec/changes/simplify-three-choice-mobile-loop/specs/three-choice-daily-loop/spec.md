## ADDED Requirements

### Requirement: The game shall present three ordered decision periods per day
Each active day SHALL contain morning, afternoon, and evening in that order. The player SHALL resolve one strategic action in each period, and the game SHALL not provide manual period skipping or an additional sleep decision during the normal loop.

#### Scenario: Player completes a normal day
- **WHEN** the player selects one action in morning, one in afternoon, and one in evening
- **THEN** the game resolves exactly three strategic actions for that day
- **THEN** the game automatically performs day-end settlement after the evening action

### Requirement: Each period shall offer at most three valid contextual actions
The game SHALL generate between two and three selectable actions for the current situation. Every displayed action SHALL be currently valid, and unavailable actions SHALL be omitted rather than shown disabled.

#### Scenario: Active problem changes available actions
- **WHEN** a persistent problem is relevant to the current period
- **THEN** at least one displayed action addresses or responds to that problem
- **THEN** the total number of displayed actions does not exceed three

### Requirement: Action selection shall advance without nested strategic choices
Selecting a period action SHALL fully determine its immediate outcome. The game SHALL NOT require a second work, reward, attendance, or event option before resolving that action.

#### Scenario: Player selects work
- **WHEN** the player selects the displayed work action
- **THEN** the game applies the listed work effects immediately
- **THEN** the player is not asked to choose a gig or confirm attendance

### Requirement: Results shall be readable before the next period
After an action resolves, the game SHALL show a compact narrative result and the resulting resource deltas in the main situation area. Continuing from that result SHALL advance to the next period or the next day without creating another strategic branch.

#### Scenario: Player reviews an action result
- **WHEN** an action changes money, energy, stress, or skill
- **THEN** the result view lists those changes
- **THEN** one continue control leads to the next decision state

### Requirement: A run shall end after twenty-one settled days
The game SHALL evaluate failure after action resolution and day settlement. A surviving player SHALL receive a final ending after settling day 21.

#### Scenario: Player survives the final evening
- **WHEN** the player completes the evening action on day 21 and remains above all failure thresholds
- **THEN** the game performs the final settlement
- **THEN** the game presents one primary ending and no further period choices

