import {
  createAnswerChoices,
  createSession,
  NUMBERS,
  QUESTIONS_PER_SESSION
} from '../src/questions.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const observedTargets = new Set<number>();
const observedCorrectPositions = new Set<number>();

for (let target = 1; target <= 10; target += 1) {
  for (let seed = 1; seed <= 1_000; seed += 1) {
    const choices = createAnswerChoices(target, createSeededRandom(seed));
    assert(choices.length === 3, `Target ${target}, seed ${seed}: must have three choices`);
    assert(new Set(choices).size === 3, `Target ${target}, seed ${seed}: choices must be unique`);
    assert(choices.includes(target), `Target ${target}, seed ${seed}: target is missing`);
  }
}

for (let seed = 1; seed <= 10_000; seed += 1) {
  const session = createSession(createSeededRandom(seed));
  assert(
    session.length === QUESTIONS_PER_SESSION,
    `Seed ${seed}: session must contain exactly eight questions`
  );
  assert(
    new Set(session.map(({ target }) => target)).size === QUESTIONS_PER_SESSION,
    `Seed ${seed}: targets must not repeat`
  );

  session.forEach((question, index) => {
    const label = `Seed ${seed}, question ${index + 1}`;
    observedTargets.add(question.target);
    assert(
      NUMBERS.includes(question.target as (typeof NUMBERS)[number]),
      `${label}: target is outside 1–10`
    );
    assert(question.choices.length === 3, `${label}: must have three choices`);
    assert(new Set(question.choices).size === 3, `${label}: choices must be unique`);
    assert(
      question.choices.every((choice) => NUMBERS.includes(choice as (typeof NUMBERS)[number])),
      `${label}: choice is outside 1–10`
    );
    assert(question.choices.includes(question.target), `${label}: target is missing`);
    assert(
      question.choices.filter((choice) => choice !== question.target).length === 2,
      `${label}: must have two valid distractors`
    );
    observedCorrectPositions.add(question.choices.indexOf(question.target));
  });
}

assert(observedTargets.size === 10, 'Every number must be able to appear as a target.');
assert(
  observedCorrectPositions.size === 3,
  'The target must appear in all three choice positions across sessions.'
);

console.log('Question invariants passed for 10,000 deterministic sessions.');
