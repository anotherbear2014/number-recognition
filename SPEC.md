# Toddler Number Recognition Game — V1 Specification

## 1. Goal

Build a simple toddler number-recognition game for iPad landscape.

This app should be derived from the existing **Toddler Counting Game** and should reuse its working architecture, styling patterns, audio behavior, animations, PWA setup, and navigation wherever practical.

The purpose of this game is **number recognition**, not counting.

The child hears a requested number and chooses that numeral from three choices.

Target age: approximately 3 years old.

The experience should be extremely simple, forgiving, and usable independently by a toddler.

---

## 2. Relationship to Existing Counting Game

Do **not** modify or destabilize the existing Toddler Counting Game.

Create a separate sibling app named:

`number-recognition`

Prefer copying/reusing the existing Counting Game implementation rather than rebuilding common functionality from scratch.

Reuse wherever practical:

- overall iPad landscape layout
- Start screen
- 1–10 exploration screen
- audio controller
- numeral styling
- three-choice interaction pattern
- correct-answer numeral enlargement
- star celebration animation
- audio-driven advancement
- end screen
- Start Again behavior
- PWA/offline configuration
- deterministic/randomized test patterns
- existing accessibility and touch-target conventions

Do not create a generalized shared game framework unless doing so is trivial and clearly reduces complexity.

For V1, keeping the new app independent is preferred over refactoring the existing working game.

---

## 3. App / Folder Location

Create the new app as a sibling to the existing Toddler Counting Game.

Preferred application folder name:

`number-recognition`

If the repository already uses an `apps/` directory, use:

`apps/number-recognition`

If the Counting Game uses another existing structure, follow that same structure rather than reorganizing the repository.

The finished Number Recognition app must have its own independent development command and build output.

---

## 4. Primary Device

Primary target:

- iPad
- landscape orientation
- approximately 1024 × 768 design baseline
- touch-first interface

The layout should remain usable on nearby tablet sizes.

Desktop support is useful for development/testing but is not the primary design target.

---

## 5. General Interaction Principles

The app should have:

- no scoring
- no lives
- no timers
- no penalties
- no failure screen
- no text-heavy instructions
- large touch targets
- immediate audio feedback
- simple transitions
- no need for reading ability

Incorrect answers should simply allow another attempt.

The child can keep tapping choices until the correct number is selected.

---

# 6. Screen Flow

The app contains four main states:

1. Start screen
2. Number exploration screen
3. Eight-question game
4. End screen

---

# 7. Start Screen

Reuse the Start screen from the existing Toddler Counting Game as closely as practical.

The screen should contain a large, obvious Start control.

Tapping Start moves to the Number Exploration screen.

If the existing Counting Game has a startup animation or decorative animation, preserve the same basic architecture but make the animation easy to replace later.

## Replaceable Start Animation

The start animation should be isolated in one clearly named component or asset location.

Preferred structure:

`src/components/StartAnimation.tsx`

If the animation relies on image/assets:

`src/assets/start-animation/`

Do not embed a complicated animation directly inside the Start screen component.

The goal is for the animation to be replaceable later without changing game logic.

Add a short code comment near the component import explaining that this is the replaceable Start-screen animation.

---

# 8. Number Exploration Screen

The first screen after Start should behave like the corresponding screen in the existing Counting Game.

Display all ten numerals:

1 2 3 4 5 6 7 8 9 10

Use large toddler-friendly buttons or tiles.

The child may tap any numeral repeatedly.

When a number is tapped, play that number's audio.

Examples:

Tap `3` → audio says:

"Three."

Tap `8` → audio says:

"Eight."

The child may replay numbers indefinitely.

Do not disable a number after it has been tapped.

## Navigation

Initially, preserve the same behavior used in the Counting Game:

- the Forward/Next arrow is hidden until at least one number has been tapped
- after the first number tap, show the Forward arrow
- tapping Forward begins the game

Reuse the existing Home/navigation conventions where applicable.

---

# 9. Game Length

Each game contains:

**8 questions**

Each session should choose **8 distinct target numbers from 1–10**.

Therefore:

- no target number repeats during a single 8-question session
- two numbers will not be targets during that session
- a new session should randomize the target set again

Shuffle the selected eight targets into random order.

---

# 10. Question Screen

Each question asks the child to identify one numeral.

Example target:

`8`

Play the prompt:

"Choose eight."

Do not display the written prompt unless needed internally for debugging.

The visual screen should primarily contain the three numeral choices.

Example:

`3       8       6`

There should be exactly three choices.

---

# 11. Answer Choice Generation

For every question:

- one choice is the correct target number
- two choices are incorrect numbers
- incorrect numbers must be distinct from each other
- incorrect numbers must not equal the target
- randomly choose the two distractors from the other nine numbers
- randomize the left/middle/right position of all three choices

Example:

Target = 7

Possible choices:

`9   4   7`

or

`7   2   5`

or

`3   7   10`

Do not intentionally introduce difficulty tiers in V1.

All numbers 1–10 may serve as distractors.

---

# 12. Prompt Audio

At the beginning of each question, play:

"Choose [number]."

Examples:

"Choose three."

"Choose eight."

"Choose ten."

The prompt should play automatically when the question appears.

The prompt must finish cleanly without overlapping prior audio.

Use the centralized audio controller from the Counting Game or equivalent.

---

# 13. Incorrect Answer Behavior

If the child selects an incorrect numeral:

1. Immediately speak the numeral that was tapped.
2. Then say:
   "Try again."
3. Remain on the same question.
4. Keep all three answer choices available.
5. Do not visually punish or mark the answer as wrong.
6. Do not increment the question counter.
7. Allow unlimited additional attempts.

Example:

Target = 8

Child taps `3`

Audio:

"Three. Try again."

The child can then tap another answer.

If the child taps `3` again, the same feedback may play again.

There is no failure state.

---

# 14. Correct Answer Behavior

If the child selects the correct numeral:

1. Disable further answer selection for that question.
2. Visually emphasize the selected numeral.
3. Enlarge the numeral using the same or similar animation used in the Counting Game.
4. Play the star celebration animation.
5. Play:
   "Yes, that's [number]."
6. After the confirmation audio and celebration complete, automatically advance to the next question.

Example:

Target = 7

Child taps `7`

Visual:

- `7` enlarges prominently
- stars animate

Audio:

"Yes, that's seven."

Then advance automatically.

No Next button is required between questions.

---

# 15. Correct-Answer Numeral Animation

Reuse the existing Counting Game numeral enlargement behavior wherever practical.

The correct numeral should become the visual focus of the screen.

A rough target similar to the Counting Game is appropriate:

approximately 480 × 480 visual area at peak size.

The numeral should remain crisp and centered.

Avoid excessive bouncing or rapid movement.

---

# 16. Star Celebration

Reuse the existing star/confetti celebration architecture if practical.

However, make the celebration easy to replace later.

Preferred structure:

`src/components/Celebration.tsx`

The question/game logic should simply call/render `Celebration`.

Do not place star-animation implementation details throughout the question component.

If the animation uses assets, put them in:

`src/assets/celebration/`

Add a short comment explaining that this component is intentionally replaceable.

The V1 implementation may use the existing star animation even if it is not the final desired animation.

Changing the celebration later should not require changing answer logic.

---

# 17. Audio Asset Organization

Audio should be especially easy to replace manually later.

Do not hard-code imported audio files individually throughout UI components.

Use one centralized audio mapping/config file.

Preferred structure:

`public/audio/`

with clear subfolders.

Example:

```text
public/
  audio/
    numbers/
      1.mp3
      2.mp3
      3.mp3
      4.mp3
      5.mp3
      6.mp3
      7.mp3
      8.mp3
      9.mp3
      10.mp3

    prompts/
      choose-1.mp3
      choose-2.mp3
      choose-3.mp3
      choose-4.mp3
      choose-5.mp3
      choose-6.mp3
      choose-7.mp3
      choose-8.mp3
      choose-9.mp3
      choose-10.mp3

    correct/
      yes-thats-1.mp3
      yes-thats-2.mp3
      yes-thats-3.mp3
      yes-thats-4.mp3
      yes-thats-5.mp3
      yes-thats-6.mp3
      yes-thats-7.mp3
      yes-thats-8.mp3
      yes-thats-9.mp3
      yes-thats-10.mp3

    feedback/
      try-again.mp3
```

If the Counting Game already has a good audio filename convention, matching that convention is acceptable.

The key requirement is that a parent can later replace an audio file by dropping a new file with the same filename into the folder.

Avoid filenames containing spaces.

Filenames and paths are case-sensitive in production and should remain consistently lowercase.

---

# 18. Audio Composition

For incorrect answers, it is acceptable and preferred to compose feedback using reusable clips:

`[number audio]` + `[try-again audio]`

Example:

`3.mp3`
then
`try-again.mp3`

This avoids needing 10 separate "Three, try again" recordings.

For prompts and correct answers, dedicated recordings are acceptable because they sound more natural:

"Choose eight."

"Yes, that's eight."

The audio controller must prevent overlapping clips.

Rapid repeated toddler taps should not produce multiple clips talking over one another.

Use the same proven strategy from the Counting Game where possible.

---

# 19. Audio Configuration

Create one obvious configuration/mapping file.

Suggested:

`src/audio/audioMap.ts`

or equivalent.

It should map numbers to:

- standalone number audio
- choose-number prompt
- yes-thats-number confirmation

Example conceptual shape:

```ts
{
  8: {
    number: "/audio/numbers/8.mp3",
    prompt: "/audio/prompts/choose-8.mp3",
    correct: "/audio/correct/yes-thats-8.mp3"
  }
}
```

The UI should not need to know exact audio filenames.

---

# 20. End Screen

After the eighth correct answer, show the End screen.

Reuse the existing Counting Game end-screen style where practical.

Display:

**The End**

and a large:

**Start Again**

control.

Tapping Start Again begins a completely new session:

- generate a new randomized set of 8 targets
- reset question progress
- return to the normal beginning flow used by the Counting Game

Prefer matching the existing Counting Game's Start Again semantics exactly unless there is a strong implementation reason not to.

---

# 21. Randomization

Randomization requirements:

At the start of each game:

1. Create numbers 1–10.
2. Shuffle them.
3. Take the first 8 as target numbers.
4. Shuffle/order them for the session.

For each target:

1. Find the other nine possible numbers.
2. Randomly select two distinct distractors.
3. Combine target + distractors.
4. Shuffle the three answer positions.

Avoid unnecessary complexity.

A standard Fisher-Yates shuffle or equivalent is sufficient.

---

# 22. State Model

A simple state model is preferred.

Conceptually:

```text
START
  ↓
EXPLORE
  ↓
QUESTION 1
  ↓
QUESTION 2
  ↓
...
QUESTION 8
  ↓
END
```

Within a question:

```text
PROMPT
  ↓
WAITING_FOR_ANSWER

wrong tap
  ↓
INCORRECT_AUDIO
  ↓
WAITING_FOR_ANSWER

correct tap
  ↓
CORRECT_ANIMATION + AUDIO
  ↓
NEXT QUESTION
```

Avoid allowing state transitions caused by rapid repeated taps during correct-answer feedback.

---

# 23. Visual Design

Reuse the existing Counting Game visual language where practical.

Priorities:

- simple
- bright
- uncluttered
- large numerals
- generous spacing
- toddler-sized touch targets
- minimal text
- clear center of attention

Do not add decorative complexity merely because this game has fewer visual elements.

The three numeral choices should be visually balanced across the screen.

---

# 24. Numeral Font

Use the same numeral font as the Counting Game unless there is a clear readability problem.

Numerals must have simple conventional shapes appropriate for learning number recognition.

Especially verify:

- `1`
- `4`
- `7`

Avoid stylized forms that could confuse a toddler.

---

# 25. PWA / Offline Use

Match the existing Counting Game behavior.

Requirements:

- installable as a PWA
- works offline after installation/cache
- all game logic works without network access
- audio assets available offline
- no external runtime dependencies required for gameplay

Reuse the existing Vite/PWA configuration where practical.

---

# 26. Development

Use the same technical stack as the existing Toddler Counting Game unless there is a compelling reason not to.

Prefer copying the existing package/app and deleting unnecessary counting/image functionality.

Do not introduce a new framework.

Keep dependencies minimal.

---

# 27. Testing Requirements

Before considering V1 complete, test:

## Screen Flow

- Start opens correctly.
- Start leads to exploration.
- Exploration contains 1–10.
- Tapping each number plays appropriate audio.
- Forward arrow appears after first exploration tap.
- Forward begins game.
- Game contains exactly 8 questions.
- End screen appears after question 8.
- Start Again works.

## Question Logic

For every target 1–10:

- correct target can appear
- target is among three choices
- distractors are unique
- distractors never equal target
- three answer positions randomize

## Incorrect Answers

Verify:

- incorrect selection does not advance
- tapped numeral is spoken
- "Try again" follows
- child can try indefinitely
- same wrong answer can be tapped repeatedly
- choices remain available

## Correct Answers

Verify:

- correct answer disables additional taps
- numeral enlarges
- celebration plays
- correct audio plays
- next question advances automatically
- no double advancement occurs

## Randomization

Run a large deterministic simulation similar to the Counting Game test approach.

At minimum test thousands of generated sessions and verify:

- exactly 8 targets/session
- no duplicate targets in a session
- all targets between 1 and 10
- exactly 3 options/question
- options unique
- target always included
- distractors valid

## Audio

Verify:

- audio clips do not overlap incorrectly
- rapid taps do not produce uncontrolled simultaneous playback
- all required files resolve
- app works offline

## Browser Console

Complete one full game manually and verify:

- no errors
- no meaningful warnings

---

# 28. V1 Non-Goals

Do not add the following in V1:

- difficulty settings
- parent settings
- scoring
- streaks
- lives
- timers
- adaptive difficulty
- spoken-number recognition
- keyboard controls for gameplay
- number tracing
- counting objects
- written word forms such as "seven"
- achievements
- analytics
- user accounts
- cloud storage
- multiple languages

Keep V1 very small.

---

# 29. Future Replaceability

Two parts of the app should deliberately be easy to change later:

## Audio

A parent should be able to replace recordings by replacing files in:

`public/audio/`

without editing game components.

## Animation

Start-screen animation and correct-answer celebration should each live behind a single component boundary.

Preferred:

```text
src/components/StartAnimation.tsx
src/components/Celebration.tsx
```

Future animation changes should not require modifications to game-state logic.

---

# 30. Definition of Done

V1 is complete when:

- the Number Recognition app runs independently
- the existing Counting Game still works unchanged
- Start screen works
- exploration screen works
- numbers 1–10 can be tapped and heard
- an 8-question randomized session works
- every question shows exactly three numeral choices
- incorrect answers say the tapped number followed by "Try again"
- correct answers enlarge the numeral and show the star celebration
- correct answers say "Yes, that's [number]"
- questions advance automatically
- End / Start Again works
- audio files are easy to replace
- celebration/start animations are easy to replace
- the app works offline as a PWA
- automated/randomized tests pass
- a full manual playthrough produces no console errors
- the existing Toddler Counting Game has not been broken