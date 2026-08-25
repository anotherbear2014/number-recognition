import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const NUMBER_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten'
];
const MASTER_ROOT = join(process.cwd(), 'new-audio');
const PRODUCTION_ROOT = join(process.cwd(), 'public/audio');
const TARGET_ACTIVE_RMS_DBFS = -18;
const MAXIMUM_GAIN_DB = 4;
const MINIMUM_GAIN_DB = -4;
const PEAK_CEILING_DBFS = -1;

const jobs = [
  ...NUMBER_WORDS.map((word, index) => ({
    source: `${word}-nichalia.wav`,
    destination: `numbers/${index + 1}.wav`
  })),
  ...NUMBER_WORDS.map((word, index) => ({
    source: `tap-the-number-${word}-nichalia.wav`,
    destination: `prompts/tap-the-number-${index + 1}.wav`
  })),
  ...NUMBER_WORDS.map((word, index) => ({
    source: `thats-${word}-nichalia.wav`,
    destination: `responses/thats-${index + 1}.wav`
  })),
  {
    source: 'numbers-opening-dialogue-nichalia.wav',
    destination: 'opening/number-opening-dialogue.wav'
  },
  { source: 'yes!-nichalia.wav', destination: 'feedback/yes.wav' },
  { source: 'try-again-nichalia.wav', destination: 'feedback/try-again.wav' },
  { source: 'good-job-nichalia.wav', destination: 'feedback/good-job.wav' },
  { source: 'well-done-nichalia.wav', destination: 'feedback/well-done.wav' },
  { source: 'good-work-nichalia.wav', destination: 'feedback/good-work.wav' }
];

function parseWave(file) {
  const wave = readFileSync(file);
  if (wave.toString('ascii', 0, 4) !== 'RIFF' || wave.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${file} is not a RIFF/WAVE file.`);
  }

  let format;
  let dataStart = -1;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= wave.length) {
    const chunkId = wave.toString('ascii', offset, offset + 4);
    const chunkSize = wave.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'fmt ') {
      format = {
        audioFormat: wave.readUInt16LE(chunkStart),
        channels: wave.readUInt16LE(chunkStart + 2),
        sampleRate: wave.readUInt32LE(chunkStart + 4),
        bitsPerSample: wave.readUInt16LE(chunkStart + 14)
      };
    }
    if (chunkId === 'data') {
      dataStart = chunkStart;
      dataSize = Math.min(chunkSize, wave.length - chunkStart);
      break;
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!format || dataStart < 0) {
    throw new Error(`${file} is missing a format or data chunk.`);
  }
  if (
    format.audioFormat !== 1 ||
    format.channels !== 1 ||
    format.sampleRate !== 44_100 ||
    format.bitsPerSample !== 16
  ) {
    throw new Error(`${file} must be 44.1 kHz, 16-bit PCM mono.`);
  }

  const samples = new Int16Array(Math.floor(dataSize / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = wave.readInt16LE(dataStart + index * 2);
  }

  return { format, samples };
}

function decibels(value) {
  return 20 * Math.log10(Math.max(value, 0.000_000_1));
}

function measure(samples, sampleRate) {
  let peak = 0;
  const normalized = new Float64Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    normalized[index] = samples[index] / 32_768;
    peak = Math.max(peak, Math.abs(normalized[index]));
  }

  const windowSize = Math.max(1, Math.floor(sampleRate * 0.05));
  const windowLevels = [];
  for (let start = 0; start < normalized.length; start += windowSize) {
    let energy = 0;
    const end = Math.min(start + windowSize, normalized.length);
    for (let index = start; index < end; index += 1) {
      energy += normalized[index] * normalized[index];
    }
    windowLevels.push(Math.sqrt(energy / (end - start)));
  }

  const maximumWindow = Math.max(...windowLevels, 0);
  const gate = Math.max(10 ** (-45 / 20), maximumWindow * 0.05);
  const activeWindows = windowLevels.filter((level) => level >= gate);
  const activeRms = Math.sqrt(
    activeWindows.reduce((sum, level) => sum + level * level, 0) /
      Math.max(1, activeWindows.length)
  );

  return { activeRmsDbfs: decibels(activeRms), peakDbfs: decibels(peak) };
}

function writeWave(file, samples, sampleRate, gainDb) {
  const gain = 10 ** (gainDb / 20);
  const dataBytes = samples.length * 2;
  const output = Buffer.alloc(44 + dataBytes);
  output.write('RIFF', 0, 'ascii');
  output.writeUInt32LE(36 + dataBytes, 4);
  output.write('WAVE', 8, 'ascii');
  output.write('fmt ', 12, 'ascii');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36, 'ascii');
  output.writeUInt32LE(dataBytes, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const adjusted = Math.max(-32_768, Math.min(32_767, Math.round(samples[index] * gain)));
    output.writeInt16LE(adjusted, 44 + index * 2);
  }

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, output);
}

const requiredSources = new Set(jobs.map(({ source }) => source));
const masterFiles = readdirSync(MASTER_ROOT);
const missing = [...requiredSources].filter((source) => !masterFiles.includes(source));
if (missing.length > 0) {
  throw new Error(`Missing required masters: ${missing.join(', ')}`);
}
for (const source of requiredSources) {
  if (statSync(join(MASTER_ROOT, source)).size === 0) {
    throw new Error(`${source} is empty.`);
  }
}

for (const { source, destination } of jobs) {
  const { format, samples } = parseWave(join(MASTER_ROOT, source));
  const measurement = measure(samples, format.sampleRate);
  const desiredGain = TARGET_ACTIVE_RMS_DBFS - measurement.activeRmsDbfs;
  const peakLimitedGain = PEAK_CEILING_DBFS - measurement.peakDbfs;
  const gainDb = Math.min(
    Math.max(MINIMUM_GAIN_DB, Math.min(MAXIMUM_GAIN_DB, desiredGain)),
    peakLimitedGain
  );

  writeWave(join(PRODUCTION_ROOT, destination), samples, format.sampleRate, gainDb);
  console.log(
    `${source} -> ${destination} | active ${measurement.activeRmsDbfs.toFixed(2)} dBFS | ` +
      `gain ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(2)} dB`
  );
}

console.log(`Integrated ${jobs.length} production WAV files without altering the masters.`);

