export const GAME_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type GameNumber = (typeof GAME_NUMBERS)[number];

export interface NumberAudioPaths {
  number: string;
  prompt: string;
  response: string;
}

export const audioPlaybackRates = {
  prompt: 0.9
} as const;

const withBase = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

export const audioMap: Record<GameNumber, NumberAudioPaths> = Object.fromEntries(
  GAME_NUMBERS.map((number) => [
    number,
    {
      number: withBase(`audio/numbers/${number}.wav`),
      prompt: withBase(`audio/prompts/tap-the-number-${number}.wav`),
      response: withBase(`audio/responses/thats-${number}.wav`)
    }
  ])
) as Record<GameNumber, NumberAudioPaths>;

export const feedbackAudio = {
  opening: withBase('audio/opening/number-opening-dialogue.wav'),
  yes: withBase('audio/feedback/yes.wav'),
  tryAgain: withBase('audio/feedback/try-again.wav'),
  praise: [
    withBase('audio/feedback/good-job.wav'),
    withBase('audio/feedback/well-done.wav'),
    withBase('audio/feedback/good-work.wav')
  ]
} as const;

export function isGameNumber(value: number): value is GameNumber {
  return GAME_NUMBERS.includes(value as GameNumber);
}
