export const GAME_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type GameNumber = (typeof GAME_NUMBERS)[number];

export interface NumberAudioPaths {
  number: string;
  prompt: string;
  correct: string;
}

const withBase = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export const audioMap: Record<GameNumber, NumberAudioPaths> = Object.fromEntries(
  GAME_NUMBERS.map((number) => [
    number,
    {
      number: withBase(`audio/numbers/${number}.wav`),
      prompt: withBase(`audio/prompts/choose-${number}.wav`),
      correct: withBase(`audio/correct/yes-thats-${number}.wav`)
    }
  ])
) as Record<GameNumber, NumberAudioPaths>;

export const feedbackAudio = {
  tryAgain: withBase('audio/feedback/try-again.wav')
} as const;

export function isGameNumber(value: number): value is GameNumber {
  return GAME_NUMBERS.includes(value as GameNumber);
}

