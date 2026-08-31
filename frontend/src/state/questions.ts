import type { IntakeAnswers } from './types';

export interface Question {
  key: keyof IntakeAnswers;
  prompt: string;
  options: string[];
}

export const QUESTIONS: Question[] = [
  { key: 'when', prompt: 'When are you thinking?', options: ['This month', 'Next few months', 'Just exploring'] },
  { key: 'who', prompt: "Who's coming?", options: ['Just me', 'Me + partner', 'Friends', 'Family'] },
  { key: 'budget', prompt: "What's the vibe?", options: ['Budget-friendly', 'Balanced', 'Treat yourself'] },
  { key: 'pace', prompt: 'Pace?', options: ['Packed itinerary', 'Relaxed', 'Bit of both'] },
];
