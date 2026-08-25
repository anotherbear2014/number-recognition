import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chooseNonRepeatingIndex, SpeechPlayback } from '../src/audio/audio-playback.ts';
import { QuestionPromptScheduler } from '../src/audio/question-prompt-scheduler.ts';
import { numberColors } from '../src/config/numberColors.ts';
import {
  CORRECT_ANSWER_DURATION_MS,
  QUESTION_PROMPT_DELAY_MS
} from '../src/config/timing.ts';

class FakeAudio {
  constructor(name, activeSounds) {
    this.name = name;
    this.activeSounds = activeSounds;
    this.currentTime = 0;
    this.paused = true;
    this.playCount = 0;
    this.listeners = new Map();
  }

  play() {
    this.paused = false;
    this.playCount += 1;
    this.activeSounds.add(this.name);
    assert.equal(this.activeSounds.size, 1, `Speech overlapped while starting ${this.name}.`);
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.activeSounds.delete(this.name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  finish() {
    this.paused = true;
    this.activeSounds.delete(this.name);
    for (const listener of [...(this.listeners.get('ended') ?? [])]) {
      listener(new Event('ended'));
    }
  }
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

const activeSounds = new Set();
const playback = new SpeechPlayback();
const number = new FakeAudio('number', activeSounds);
const tryAgain = new FakeAudio('try-again', activeSounds);
const incorrectSequence = playback.playSequence([number, tryAgain]);

assert.equal(number.playCount, 1);
assert.equal(tryAgain.playCount, 0, 'Try again must wait for the numeral.');
number.finish();
await flushPromises();
assert.equal(tryAgain.playCount, 1, 'Try again should follow the numeral.');
tryAgain.finish();
assert.equal(await incorrectSequence, true);

const interruptedNumber = new FakeAudio('interrupted-number', activeSounds);
const canceledTryAgain = new FakeAudio('canceled-try-again', activeSounds);
const replacement = new FakeAudio('replacement', activeSounds);
const canceledSequence = playback.playSequence([interruptedNumber, canceledTryAgain]);
playback.play(replacement);
await flushPromises();
assert.equal(interruptedNumber.paused, true);
assert.equal(canceledTryAgain.playCount, 0, 'A superseded sequence must not continue.');
assert.equal(replacement.playCount, 1);
assert.equal(await canceledSequence, false);
replacement.finish();

const yes = new FakeAudio('yes', activeSounds);
const response = new FakeAudio('thats-eight', activeSounds);
const praise = new FakeAudio('good-job', activeSounds);
const correctSequence = playback.playSequence([yes, response, praise]);
assert.equal(yes.playCount, 1);
assert.equal(response.playCount, 0);
assert.equal(praise.playCount, 0);
yes.finish();
await flushPromises();
assert.equal(response.playCount, 1, 'The response must follow Yes.');
response.finish();
await flushPromises();
assert.equal(praise.playCount, 1, 'Praise must follow the number response.');
praise.finish();
assert.equal(await correctSequence, true);

const observedPraiseIndices = new Set();
let previousPraiseIndex = null;
const randomValues = [0.01, 0.42, 0.88];
for (let index = 0; index < 30; index += 1) {
  const praiseIndex = chooseNonRepeatingIndex(
    3,
    previousPraiseIndex,
    () => randomValues[index % randomValues.length]
  );
  assert.notEqual(praiseIndex, previousPraiseIndex, 'Praise must not repeat consecutively.');
  observedPraiseIndices.add(praiseIndex);
  previousPraiseIndex = praiseIndex;
}
assert.deepEqual(observedPraiseIndices, new Set([0, 1, 2]));

let nextTimerId = 1;
const pendingTimers = new Map();
const canceledTimerIds = [];
const promptScheduler = new QuestionPromptScheduler(
  (callback, delayMs) => {
    const timerId = nextTimerId;
    nextTimerId += 1;
    pendingTimers.set(timerId, { callback, delayMs });
    return timerId;
  },
  (timerId) => {
    canceledTimerIds.push(timerId);
    pendingTimers.delete(timerId);
  }
);
let firstPromptCount = 0;
let currentPromptCount = 0;
promptScheduler.schedule(() => {
  firstPromptCount += 1;
}, QUESTION_PROMPT_DELAY_MS);
const firstTimerId = nextTimerId - 1;
assert.equal(pendingTimers.get(firstTimerId).delayMs, 1000);
promptScheduler.schedule(() => {
  currentPromptCount += 1;
}, QUESTION_PROMPT_DELAY_MS);
const currentTimerId = nextTimerId - 1;
assert.deepEqual(canceledTimerIds, [firstTimerId], 'A new question must cancel the old prompt.');
assert.equal(pendingTimers.has(firstTimerId), false);
const currentTimer = pendingTimers.get(currentTimerId);
pendingTimers.delete(currentTimerId);
currentTimer.callback();
assert.equal(firstPromptCount, 0, 'A stale question prompt must not play.');
assert.equal(currentPromptCount, 1, 'The current question prompt must play exactly once.');
assert.equal(pendingTimers.has(currentTimerId), false, 'A fired prompt timer must not remain pending.');
promptScheduler.schedule(() => {
  currentPromptCount += 1;
}, QUESTION_PROMPT_DELAY_MS);
const answerTimerId = nextTimerId - 1;
promptScheduler.cancel();
assert.equal(pendingTimers.has(answerTimerId), false, 'Answer feedback must cancel a pending prompt.');

const expectedFiles = [
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/numbers/${index + 1}.wav`)),
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/prompts/tap-the-number-${index + 1}.wav`)),
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/responses/thats-${index + 1}.wav`)),
  join(process.cwd(), 'public/audio/opening/number-opening-dialogue.wav'),
  join(process.cwd(), 'public/audio/feedback/yes.wav'),
  join(process.cwd(), 'public/audio/feedback/try-again.wav'),
  join(process.cwd(), 'public/audio/feedback/good-job.wav'),
  join(process.cwd(), 'public/audio/feedback/well-done.wav'),
  join(process.cwd(), 'public/audio/feedback/good-work.wav')
];

for (const file of expectedFiles) {
  const wave = readFileSync(file);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF', file);
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE', file);
  assert.equal(wave.readUInt16LE(22), 1, `${file} must be mono.`);
  assert.equal(wave.readUInt32LE(24), 44_100, `${file} must use 44.1 kHz audio.`);
  assert.equal(wave.readUInt16LE(34), 16, `${file} must use 16-bit PCM.`);
}

const mainSource = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
const audioMapSource = readFileSync(join(process.cwd(), 'src/audio/audioMap.ts'), 'utf8');
const startAnimationSource = readFileSync(
  join(process.cwd(), 'src/components/StartAnimation.ts'),
  'utf8'
);
const stylesSource = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
assert.deepEqual(numberColors, {
  1: '#D32F2F',
  2: '#F57C00',
  3: '#388E3C',
  4: '#B8860B',
  5: '#000000',
  6: '#795548',
  7: '#008080',
  8: '#7B1FA2',
  9: '#C2185B',
  10: '#1976D2'
});
assert.equal(CORRECT_ANSWER_DURATION_MS, 3000);
assert.equal(QUESTION_PROMPT_DELAY_MS, 1000);
assert.match(mainSource, /questionPromptScheduler\.schedule/);
assert.match(mainSource, /questionPromptScheduler\.cancel/);
assert.match(mainSource, /renderStartAnimation/);
assert.match(mainSource, /renderCelebration/);
assert.match(mainSource, /phase = 'correct'/);
assert.match(audioMapSource, /prompt:\s*0\.9/);
assert.match(mainSource, /prompt\.playbackRate\s*=\s*audioPlaybackRates\.prompt/);
assert.doesNotMatch(mainSource, /(?:number|response)\.playbackRate/);
assert.match(audioMapSource, /tap-the-number-\$\{number\}\.wav/);
assert.match(audioMapSource, /responses\/thats-\$\{number\}\.wav/);
assert.match(mainSource, /speechPlayback\.play\(openingDialogueSound\)/);
assert.match(mainSource, /\[yesSound,\s*audioBank\[answer\]\.response,\s*choosePraiseSound\(\)\]/);
assert.match(mainSource, /\[audioBank\[answer\]\.response,\s*tryAgainSound\]/);
assert.doesNotMatch(audioMapSource, /choose-|yes-thats-/);
assert.doesNotMatch(startAnimationSource, />[1-9][0-9]*</);
assert.match(mainSource, /--correct-answer-duration:\s*\$\{CORRECT_ANSWER_DURATION_MS\}ms/);
assert.match(stylesSource, /font-size:\s*clamp\(88px,\s*14vmin,\s*128px\)/);
assert.match(stylesSource, /--star-animation-duration:\s*1760ms/);
assert.match(stylesSource, /color:\s*var\(--number-color\)/);

console.log(
  `Audio sequencing, interruption handling, and ${expectedFiles.length} local WAV files passed validation.`
);
