import type { GameNumber } from '../audio/audioMap';

export const numberColors: Record<GameNumber, string> = {
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
};

export function getNumberColor(number: number): string {
  return numberColors[number as GameNumber] ?? '#213b43';
}

