import './styles.css';
import { audioMap, feedbackAudio, GAME_NUMBERS, isGameNumber } from './audio/audioMap';
import { SpeechPlayback } from './audio/audio-playback';
// Replace this import to swap the Start-screen animation without touching game logic.
import { renderStartAnimation } from './components/StartAnimation';
// Celebration is intentionally isolated so a future animation can replace it independently.
import { renderCelebration } from './components/Celebration';
import { createSession, type Question } from './questions';

type GamePhase = 'start' | 'exploration' | 'question' | 'correct' | 'end';

type NumeralOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
};

function getAppRoot(): HTMLElement {
  const element = document.querySelector<HTMLElement>('#app');

  if (!element) {
    throw new Error('The application root was not found.');
  }

  return element;
}

const app = getAppRoot();
const speechPlayback = new SpeechPlayback();
const audioBank = Object.fromEntries(
  GAME_NUMBERS.map((number) => [
    number,
    {
      number: new Audio(audioMap[number].number),
      prompt: new Audio(audioMap[number].prompt),
      correct: new Audio(audioMap[number].correct)
    }
  ])
) as Record<
  (typeof GAME_NUMBERS)[number],
  { number: HTMLAudioElement; prompt: HTMLAudioElement; correct: HTMLAudioElement }
>;
const tryAgainSound = new Audio(feedbackAudio.tryAgain);

[
  ...Object.values(audioBank).flatMap(({ number, prompt, correct }) => [number, prompt, correct]),
  tryAgainSound
].forEach((sound) => {
  sound.preload = 'auto';
});

let questions: Question[] = [];
let questionIndex = 0;
let phase: GamePhase = 'start';
let explorationHasSelection = false;

function renderStart(): void {
  phase = 'start';
  explorationHasSelection = false;
  app.innerHTML = `
    <section class="start-screen" aria-label="Number recognition game">
      ${renderStartAnimation()}
      <button class="start-button" type="button" data-start>Start</button>
    </section>`;
}

function renderExploration(): void {
  phase = 'exploration';
  explorationHasSelection = false;
  app.innerHTML = `
    <section class="exploration-screen" aria-label="Explore numbers">
      <div class="number-grid" aria-label="Choose a number">
        ${GAME_NUMBERS.map(
          (number) => `
            <button
              class="number-button"
              type="button"
              data-explore-number="${number}"
              aria-label="${number}"
            >${number}</button>`
        ).join('')}
      </div>
      <button
        class="start-arrow-button"
        type="button"
        data-start-game
        aria-label="Start number game"
        hidden
      ><span aria-hidden="true">→</span></button>
    </section>`;
}

function startExploration(): void {
  if (phase !== 'start') {
    return;
  }

  renderExploration();
}

function chooseExplorationNumber(number: number): void {
  if (phase !== 'exploration' || !isGameNumber(number)) {
    return;
  }

  speechPlayback.play(audioBank[number].number);

  if (!explorationHasSelection) {
    explorationHasSelection = true;
    app.querySelector<HTMLButtonElement>('[data-start-game]')?.removeAttribute('hidden');
  }
}

function renderAnswers(question: Question): string {
  return question.choices
    .map(
      (choice) => `
        <button
          class="answer-button"
          type="button"
          data-answer="${choice}"
          aria-label="${choice}"
        >${choice}</button>`
    )
    .join('');
}

function renderQuestion(): void {
  const question = questions[questionIndex];

  app.innerHTML = `
    <section
      class="game-screen"
      aria-label="Choose the number you hear"
      data-question-number="${questionIndex + 1}"
      data-target="${question.target}"
    >
      <div class="answer-row" aria-label="Choose a number">
        ${renderAnswers(question)}
      </div>
    </section>`;

  if (isGameNumber(question.target)) {
    speechPlayback.play(audioBank[question.target].prompt);
  }
}

function startGame(): void {
  if (phase !== 'exploration' || !explorationHasSelection) {
    return;
  }

  speechPlayback.stop();
  questions = createSession();
  questionIndex = 0;
  phase = 'question';
  renderQuestion();
}

function getNumeralOrigin(button: HTMLButtonElement): NumeralOrigin {
  const rect = button.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    fontSize: Number.parseFloat(window.getComputedStyle(button).fontSize)
  };
}

function renderCorrectAnswer(answer: number, origin: NumeralOrigin): void {
  app.innerHTML = `
    <section class="reinforcement-screen" aria-label="Correct answer">
      ${renderCelebration()}
      <div
        class="reinforced-numeral"
        aria-label="${answer}"
        style="
          --source-left: ${origin.left}px;
          --source-top: ${origin.top}px;
          --source-width: ${origin.width}px;
          --source-height: ${origin.height}px;
          --source-font-size: ${origin.fontSize}px;
        "
      >${answer}</div>
    </section>`;
}

function waitForCelebration(): Promise<void> {
  const screen = app.querySelector<HTMLElement>('.reinforcement-screen');
  if (!screen) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleAnimationEnd = (event: AnimationEvent): void => {
      if (event.target !== screen || event.animationName !== 'celebration-lifecycle') {
        return;
      }
      screen.removeEventListener('animationend', handleAnimationEnd);
      resolve();
    };

    screen.addEventListener('animationend', handleAnimationEnd);
  });
}

async function completeCorrectAnswer(answer: number): Promise<void> {
  if (!isGameNumber(answer)) {
    return;
  }

  await Promise.all([
    waitForCelebration(),
    speechPlayback.playSequence([audioBank[answer].correct])
  ]);

  if (phase !== 'correct') {
    return;
  }

  questionIndex += 1;
  if (questionIndex === questions.length) {
    phase = 'end';
    renderEnd();
    return;
  }

  phase = 'question';
  renderQuestion();
}

async function playIncorrectFeedback(answer: number): Promise<void> {
  if (!isGameNumber(answer)) {
    return;
  }

  await speechPlayback.playSequence([audioBank[answer].number, tryAgainSound]);
}

function chooseAnswer(answer: number, sourceButton: HTMLButtonElement): void {
  if (phase !== 'question') {
    return;
  }

  const question = questions[questionIndex];
  if (answer !== question.target) {
    void playIncorrectFeedback(answer);
    return;
  }

  const origin = getNumeralOrigin(sourceButton);
  phase = 'correct';
  speechPlayback.stop();
  renderCorrectAnswer(answer, origin);
  void completeCorrectAnswer(answer);
}

function renderEnd(): void {
  app.innerHTML = `
    <section class="end-screen">
      <h1>The End</h1>
      <button class="start-again-button" type="button" data-start-again>Start Again</button>
    </section>`;
}

function startAgain(): void {
  speechPlayback.stop();
  questions = [];
  questionIndex = 0;
  renderStart();
}

app.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  if (target.closest('[data-start]')) {
    startExploration();
    return;
  }

  const explorationNumber = target.closest<HTMLButtonElement>('[data-explore-number]');
  if (explorationNumber) {
    chooseExplorationNumber(Number(explorationNumber.dataset.exploreNumber));
    return;
  }

  if (target.closest('[data-start-game]')) {
    startGame();
    return;
  }

  const answerButton = target.closest<HTMLButtonElement>('[data-answer]');
  if (answerButton) {
    chooseAnswer(Number(answerButton.dataset.answer), answerButton);
    return;
  }

  if (target.closest('[data-start-again]')) {
    startAgain();
  }
});

renderStart();
