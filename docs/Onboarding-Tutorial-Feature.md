# Workspace Onboarding Tutorial

## Improved implementation prompt

Design, implement, and validate a first-run onboarding tutorial for the Lock In workspace. The tutorial must explain the core capture, organization, AI companion, and voice workflows in four short steps; match the existing dark Lock In workspace theme and technical visual language; be responsive and keyboard-accessible; persist completion in the browser; and remain reopenable from a low-distraction help control. Keep the implementation local to the workspace shell, avoid new database schema or authentication dependencies, and preserve all existing workspace behavior.

Implement the feature in small, testable slices. After implementation, run the narrowest available typecheck/build validation, start the local app when environment prerequisites allow, and manually verify first-run display, step navigation, skip, completion persistence, reopen behavior, mobile layout, and interaction with the existing workspace chrome. Do not finalize related documentation or deploy until the product owner confirms the local behavior is acceptable.

## Outcome-based onboarding prompt

Design, implement, and validate an outcome-based first-session onboarding for the Lock In workspace. The experience must ask what the user wants to accomplish, guide them to one meaningful first action, and leave them with a real next step. Offer goal paths for capturing an idea, organizing work, planning tasks, working with AI, and browsing examples. The capture path must create and open a real note titled `My first idea`; the other paths must open the relevant existing workspace surface. Keep the guide short, dismissible, reopenable, responsive, keyboard-accessible, and consistent with the existing dark Lock In theme.

Do not automatically create sample content for every new user. Examples must be optional and clearly separated from personal work. Validate the primary success metric: a new user can choose a goal and reach a useful workspace action within two minutes.

## Feature detail

### Problem

New users land in a capable workspace with several capture and organization tools but no guided orientation. The first useful action is not obvious, and the product's most distinctive AI and voice workflows are easy to miss.

### Outcome

After onboarding, a new user should be able to:

1. Choose the job they came to do.
2. Complete one useful first action.
3. Understand the next tool that can move the work forward.

The primary success metric is: a new user creates one useful artifact or opens one relevant workflow within two minutes.

### Interaction contract

- Show automatically once per browser on the workspace shell.
- Start with a goal choice, then show one first-action explanation and CTA.
- Provide a Back to choices action after a goal is selected.
- Allow closing at any point; closing counts as dismissed.
- Persist completion or dismissal with a namespaced `localStorage` key.
- Provide a help icon to reopen the tutorial at step one.
- Create a real first note for the capture path and route other goals to their existing workspace surfaces.
- Do not provision sample notes automatically during onboarding.
- Keep the underlying workspace mounted and preserve its state.
- Support narrow screens without horizontal overflow.
- Expose dialog semantics, labels, and a visible focus ring through existing controls.

### Persistent design rules

- Use the live workspace palette: `#0E0E0E` canvas, `#131313` surface, `#27272A` hairline, `#10B981` action color, and white or zinc text.
- Keep the technical uppercase microcopy style for metadata only; use sentence case for instructional content.
- Use square controls and restrained borders consistent with the existing Lock In shell.
- Use one strong emerald action, not competing calls to action.
- Keep the panel compact, high contrast, and readable over the workspace.
- Use Lucide icons already installed in the repository.

## Task and action items

### Task 1: Define the onboarding contract

- [x] Record the improved prompt and interaction contract.
- [x] Select workspace layout as the owning integration boundary.
- [x] Define the persistent design rules and local storage key.

### Task 2: Implement the tutorial

- [x] Add a reusable client tutorial component.
- [x] Add first-run detection and dismissal persistence.
- [x] Replace the passive tour with goal selection and first-action guidance.
- [x] Create and open a real first note from the capture goal.
- [x] Route organize, planning, AI, and examples goals to existing workspace surfaces.
- [x] Mount the tutorial in the authenticated workspace shell.

### Task 3: Validate locally

- [x] Run typecheck/build validation.
- [ ] Verify first-run behavior in a clean browser context.
- [ ] Verify goal selection, Back, first-note creation, routing, dismissal, replay, and responsive layout.
- [ ] Confirm existing workspace controls remain usable under the overlay.

### Task 4: Owner confirmation and release

- [ ] Product owner confirms local behavior is acceptable.
- [ ] Update related docs and release material after confirmation.
- [ ] Deploy using the repository's approved deployment process.

## Acceptance checklist

- [ ] Tutorial appears on first workspace visit with a goal choice.
- [ ] Capture goal creates and opens `My first idea`.
- [ ] Organize goal opens the workspace Explorer.
- [ ] Organize goal expands the Explorer panel and all existing folders.
- [ ] Explorer guidance visibly explains folders, moving material, search, sorting, and filtering.
- [ ] Plan goal opens Tasks.
- [ ] AI goal opens the AI companion.
- [ ] Close persists dismissal.
- [ ] Help control reopens step one after dismissal.
- [ ] No horizontal overflow at mobile width.
- [ ] Build/typecheck passes without new errors.
- [ ] Existing workspace behavior is unchanged after dismissal.
- [ ] Modal backdrop is dimmed without blur and preserves workspace context.