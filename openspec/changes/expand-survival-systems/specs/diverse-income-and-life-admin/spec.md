## ADDED Requirements

### Requirement: The game SHALL provide a mixed action catalog of full-day and half-day choices
On each active day, the game SHALL present both legacy survival actions and newly added utility actions using slot-aware definitions. The expanded catalog SHALL include at least standard work, overtime, study, rest, job search, side gigs, freelance-style work, life-admin handling, and a social or relationship-building action.

#### Scenario: Player views the expanded catalog on a fresh day
- **WHEN** the player starts a day with usable slots remaining
- **THEN** the UI shows a mix of income, recovery, growth, and utility actions
- **THEN** each action indicates whether it is a full-day or half-day choice

### Requirement: The game SHALL support money-making actions beyond standard employment
The game SHALL include at least one generally available side-gig action and at least one gated freelance-style action whose availability depends on player state such as skill level or an opportunity flag. These actions SHALL use distinct tradeoffs rather than duplicating standard work exactly.

#### Scenario: Side gig is available without a special unlock
- **WHEN** the player is on a day where a one-slot income action can fit
- **THEN** the side-gig action is available without requiring a job-tier upgrade
- **THEN** resolving it grants money with a lighter or differently shaped cost profile than full-day work

#### Scenario: Freelance action requires readiness
- **WHEN** the player does not yet meet the freelance eligibility condition
- **THEN** the freelance-style action is shown as locked or unavailable
- **THEN** the UI explains the missing requirement such as skill or a contact opportunity

#### Scenario: Freelance action becomes available after setup
- **WHEN** the player reaches the required readiness condition for freelance-style work
- **THEN** the freelance action becomes selectable on future days where it fits the remaining slots

### Requirement: Utility actions SHALL solve practical problems or create future opportunities
The game SHALL provide at least one life-admin action that addresses active practical problems and at least one social or opportunity-building action that can improve future income or event access. These actions SHALL compete for the same daily slot budget as money and recovery actions.

#### Scenario: Life-admin action can clear an active problem
- **WHEN** the player has an active practical condition such as broken transport or device trouble
- **THEN** the life-admin action can resolve or mitigate that condition at an appropriate time or money cost

#### Scenario: Social action can create future opportunities
- **WHEN** the player spends a slot on the social or relationship-building action
- **THEN** the game may improve mood immediately
- **THEN** the game may also create a future opportunity flag that later actions or events can use

### Requirement: The game SHALL preserve job progression while broadening the economy
Standard job progression and tier-based income SHALL remain part of the game, but the player's monthly survival plan SHALL no longer depend exclusively on standard work and overtime. The action system SHALL support viable runs that meaningfully combine employment, side income, and utility actions.

#### Scenario: Player survives using a mixed income plan
- **WHEN** a player alternates job income with side-gig or freelance-style actions across a run
- **THEN** the rule system treats those actions as legitimate sources of survival income
- **THEN** the game does not require standard work to be the only repeatable earning path
