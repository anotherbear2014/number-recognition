import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chooseNonRepeatingIndex, SpeechPlayback } from '../src/audio/audio-playback.ts';
import { QuestionPromptScheduler } from '../src/audio/question-prompt-scheduler.ts';
import { audioMap, audioPlaybackRates, GAME_NUMBERS } from '../src/audio/audioMap.ts';
import { numberColors } from '../src/config/numberColors.ts';
import {
  CORRECT_ANSWER_DURATION_MS,
  QUESTION_PROMPT_DELAY_MS
} from '../src/config/timing.ts';

class FakeAudio {
  constructor(activeSounds) {
    this.activeSounds = activeSounds;
    this.src = '';
    this.playbackRate = 1;
    this.preload = '';
    this.currentTime = 0;
    this.paused = true;
    this.playCount = 0;
    this.loadCount = 0;
    this.playSources = [];
    this.listeners = new Map();
    this.activeSource = null;
    this.nextPlayError = null;
  }

  play() {
    this.playCount += 1;
    this.playSources.push(this.src);

    if (this.nextPlayError) {
      const error = this.nextPlayError;
      this.nextPlayError = null;
      return Promise.reject(error);
    }

    this.paused = false;
    this.activeSource = this.src;
    this.activeSounds.add(this.activeSource);
    assert.equal(this.activeSounds.size, 1, `Speech overlapped while starting ${this.src}.`);
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    if (this.activeSource) {
      this.activeSounds.delete(this.activeSource);
      this.activeSource = null;
    }
  }

  load() {
    this.loadCount += 1;
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
    this.pause();
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
const playbackFailures = [];
const persistentPlayer = new FakeAudio(activeSounds);
const playback = new SpeechPlayback(persistentPlayer, (error, clip) => {
  playbackFailures.push({ error, clip });
});

const openingClip = { src: 'opening.wav' };
const unlockPlayback = playback.unlock(openingClip);
assert.equal(persistentPlayer.preload, 'auto');
assert.equal(persistentPlayer.src, openingClip.src);
assert.equal(persistentPlayer.playCount, 1, 'Unlock must play on the persistent element.');
persistentPlayer.finish();
assert.equal(await unlockPlayback, true);

const promptClip = { src: audioMap[0].prompt, playbackRate: audioPlaybackRates.prompt };
const loadCountBeforePrompt = persistentPlayer.loadCount;
playback.prepare(promptClip);
assert.equal(persistentPlayer.src, promptClip.src);
assert.equal(persistentPlayer.playbackRate, 0.9);
assert.equal(persistentPlayer.loadCount, loadCountBeforePrompt + 1);
const promptPlayback = playback.play(promptClip);
assert.equal(
  persistentPlayer.loadCount,
  loadCountBeforePrompt + 1,
  'A prepared automatic prompt should reuse the loaded source.'
);
assert.equal(persistentPlayer.playSources.filter((src) => src === promptClip.src).length, 1);
persistentPlayer.finish();
assert.equal(await promptPlayback, true);

const incorrectResponseClip = { src: audioMap[0].response };
const tryAgainClip = { src: 'try-again.wav' };
const incorrectSequence = playback.playSequence([incorrectResponseClip, tryAgainClip]);

assert.equal(persistentPlayer.src, incorrectResponseClip.src);
assert.equal(persistentPlayer.playbackRate, 1, 'Non-prompt audio must retain normal speed.');
assert.equal(persistentPlayer.playSources.includes(tryAgainClip.src), false);
persistentPlayer.finish();
await flushPromises();
assert.equal(persistentPlayer.src, tryAgainClip.src, 'Try again should follow the numeral.');
persistentPlayer.finish();
assert.equal(await incorrectSequence, true);

const interruptedNumberClip = { src: 'interrupted-number.wav' };
const canceledTryAgainClip = { src: 'canceled-try-again.wav' };
const replacementClip = { src: 'replacement.wav' };
const canceledSequence = playback.playSequence([interruptedNumberClip, canceledTryAgainClip]);
const replacementPlayback = playback.play(replacementClip);
await flushPromises();
assert.equal(
  persistentPlayer.playSources.includes(canceledTryAgainClip.src),
  false,
  'A superseded sequence must not continue.'
);
assert.equal(persistentPlayer.src, replacementClip.src);
assert.equal(await canceledSequence, false);
persistentPlayer.finish();
assert.equal(await replacementPlayback, true);

const yesClip = { src: 'yes.wav' };
const responseClip = { src: audioMap[0].response };
const praiseClip = { src: 'good-job.wav' };
const correctSequence = playback.playSequence([yesClip, responseClip, praiseClip]);
assert.equal(persistentPlayer.src, yesClip.src);
persistentPlayer.finish();
await flushPromises();
assert.equal(persistentPlayer.src, responseClip.src, 'The response must follow Yes.');
persistentPlayer.finish();
await flushPromises();
assert.equal(persistentPlayer.src, praiseClip.src, 'Praise must follow the number response.');
persistentPlayer.finish();
assert.equal(await correctSequence, true);

const rejectedPlayError = new Error('Autoplay was rejected.');
persistentPlayer.nextPlayError = rejectedPlayError;
const rejectedPlayback = await playback.play({ src: 'blocked-prompt.wav' });
assert.equal(rejectedPlayback, false, 'A rejected play promise must settle as a failed playback.');
assert.deepEqual(playbackFailures, [
  { error: rejectedPlayError, clip: { src: 'blocked-prompt.wav' } }
]);

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
  ...GAME_NUMBERS.map((number) => join(process.cwd(), `public/audio/numbers/${number}.wav`)),
  ...GAME_NUMBERS.map((number) =>
    join(process.cwd(), `public/audio/prompts/tap-the-number-${number}.wav`)
  ),
  ...GAME_NUMBERS.map((number) => join(process.cwd(), `public/audio/responses/thats-${number}.wav`)),
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
const audioPlaybackSource = readFileSync(
  join(process.cwd(), 'src/audio/audio-playback.ts'),
  'utf8'
);
const audioIntegrationSource = readFileSync(
  join(process.cwd(), 'scripts/integrate-new-audio.mjs'),
  'utf8'
);
const startAnimationSource = readFileSync(
  join(process.cwd(), 'src/components/StartAnimation.ts'),
  'utf8'
);
const stylesSource = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');
assert.deepEqual(numberColors, {
  0: '#555B61',
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
assert.deepEqual(GAME_NUMBERS, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(audioMap[0].number, '/audio/numbers/0.wav');
assert.equal(audioMap[0].prompt, '/audio/prompts/tap-the-number-0.wav');
assert.equal(audioMap[0].response, '/audio/responses/thats-0.wav');
assert.equal(audioPlaybackRates.prompt, 0.9);
assert.equal(CORRECT_ANSWER_DURATION_MS, 3000);
assert.equal(QUESTION_PROMPT_DELAY_MS, 1000);
assert.match(mainSource, /questionPromptScheduler\.schedule/);
assert.match(mainSource, /questionPromptScheduler\.cancel/);
assert.match(mainSource, /renderStartAnimation/);
assert.match(mainSource, /renderCelebration/);
assert.match(mainSource, /phase = 'correct'/);
assert.match(audioMapSource, /prompt:\s*0\.9/);
assert.match(mainSource, /playbackRate:\s*audioPlaybackRates\.prompt/);
assert.doesNotMatch(mainSource, /(?:number|response)\.playbackRate/);
assert.doesNotMatch(mainSource, /new Audio\s*\(/);
assert.equal(
  (audioPlaybackSource.match(/new Audio\s*\(/g) ?? []).length,
  1,
  'The centralized controller must own exactly one persistent audio element.'
);
assert.match(mainSource, /speechPlayback\.unlock\(openingDialogueClip\)/);
assert.match(mainSource, /speechPlayback\.prepare\(promptClip\)/);
assert.match(mainSource, /speechPlayback\.play\(promptClip\)/);
assert.match(mainSource, /GAME_NUMBERS\.map/);
assert.match(mainSource, /data-explore-number="\$\{number\}"/);
assert.match(mainSource, /speechPlayback\.play\(audioBank\[number\]\.number\)/);
assert.match(audioPlaybackSource, /player\.play\(\)\.catch\(fail\)/);
assert.match(audioMapSource, /tap-the-number-\$\{number\}\.wav/);
assert.match(audioMapSource, /responses\/thats-\$\{number\}\.wav/);
assert.match(audioIntegrationSource, /thats-8-v2-nichalia\.wav/);
assert.doesNotMatch(audioIntegrationSource, /thats-eight-nichalia\.wav/);
assert.match(mainSource, /\[yesClip,\s*audioBank\[answer\]\.response,\s*choosePraiseClip\(\)\]/);
assert.match(mainSource, /\[audioBank\[answer\]\.response,\s*tryAgainClip\]/);
assert.doesNotMatch(audioMapSource, /choose-|yes-thats-/);
assert.doesNotMatch(startAnimationSource, />[1-9][0-9]*</);
assert.match(mainSource, /--correct-answer-duration:\s*\$\{CORRECT_ANSWER_DURATION_MS\}ms/);
assert.match(stylesSource, /font-size:\s*clamp\(88px,\s*14vmin,\s*128px\)/);
assert.match(stylesSource, /width:\s*calc\(6 \* var\(--explore-button-size\)/);
assert.match(stylesSource, /--star-animation-duration:\s*1760ms/);
assert.match(stylesSource, /color:\s*var\(--number-color\)/);

console.log(
  `Audio sequencing, interruption handling, and ${expectedFiles.length} local WAV files passed validation.`
);
