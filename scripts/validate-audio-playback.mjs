import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SpeechPlayback } from '../src/audio/audio-playback.ts';

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

const expectedFiles = [
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/numbers/${index + 1}.wav`)),
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/prompts/choose-${index + 1}.wav`)),
  ...Array.from({ length: 10 }, (_, index) => join(process.cwd(), `public/audio/correct/yes-thats-${index + 1}.wav`)),
  join(process.cwd(), 'public/audio/feedback/try-again.wav')
];

for (const file of expectedFiles) {
  const wave = readFileSync(file);
  assert.equal(wave.toString('ascii', 0, 4), 'RIFF', file);
  assert.equal(wave.toString('ascii', 8, 12), 'WAVE', file);
  assert.equal(wave.readUInt16LE(22), 1, `${file} must be mono.`);
  assert.equal(wave.readUInt32LE(24), 48_000, `${file} must use 48 kHz audio.`);
  assert.equal(wave.readUInt16LE(34), 16, `${file} must use 16-bit PCM.`);
}

const mainSource = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8');
assert.doesNotMatch(mainSource, /setTimeout\s*\(/);
assert.match(mainSource, /renderStartAnimation/);
assert.match(mainSource, /renderCelebration/);
assert.match(mainSource, /phase = 'correct'/);

console.log(
  `Audio sequencing, interruption handling, and ${expectedFiles.length} local WAV files passed validation.`
);
