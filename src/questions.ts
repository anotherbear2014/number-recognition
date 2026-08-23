export type RandomSource = () => number;

export interface Question {
  target: number;
  choices: number[];
}

export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const QUESTIONS_PER_SESSION = 8;

export function shuffle<T>(values: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function createAnswerChoices(
  target: number,
  random: RandomSource = Math.random
): number[] {
  const distractors = shuffle(
    NUMBERS.filter((number) => number !== target),
    random
  ).slice(0, 2);

  return shuffle([target, ...distractors], random);
}

export function createSession(random: RandomSource = Math.random): Question[] {
  return shuffle(NUMBERS, random)
    .slice(0, QUESTIONS_PER_SESSION)
    .map((target) => ({
      target,
      choices: createAnswerChoices(target, random)
    }));
}

