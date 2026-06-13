## 1. Reduced Game Model

- [x] 1.1 Replace configuration with the 21-day run, four mutable resources, passive traits, three employment states, limited conditions, and contextual period actions.
- [x] 1.2 Replace the existing phase and slot engine with a morning-afternoon-evening cursor and automatic evening settlement.
- [x] 1.3 Implement prioritized contextual option generation with two or three valid actions and no nested strategic choices.

## 2. Survival And Work Rules

- [x] 2.1 Implement direct work, job search, absence, employment loss, and skill-gated freelance outcomes.
- [x] 2.2 Implement simplified living costs, automatic rent payment, rent debt failure, sleep recovery, and four-resource failure rules.
- [x] 2.3 Implement at most two actionable persistent problems and fold random events into current situations and options.
- [x] 2.4 Implement compact endings and run summaries for the reduced model.

## 3. Mobile Single-Screen UI

- [x] 3.1 Replace the document structure with a single-column active game shell containing header, status controls, situation, and action stack.
- [x] 3.2 Implement the renderer and interactions for direct action selection, inline results, continuation, intro, ending, utility controls, and reset confirmation.
- [x] 3.3 Implement tappable SVG icon statuses with accessible bottom-sheet explanations and focus restoration.
- [x] 3.4 Replace the stylesheet with mobile-first 360 by 640 layout rules, 56px action targets, safe-area handling, and reduced-motion support.

## 4. Verification

- [x] 4.1 Rewrite deterministic gameplay verification for three decisions per day, employment, rent, conditions, failure, and completion.
- [x] 4.2 Rewrite balance simulation for the 21-day contextual-choice loop and confirm multiple viable endings.
- [x] 4.3 Update the UI smoke test and manual verification notes for the single-screen mobile flow.
- [x] 4.4 Run all automated checks and inspect active gameplay at 360 by 640 and a larger mobile viewport.
