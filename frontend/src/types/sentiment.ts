export type SentimentRange = number;

export interface SentimentScore {
  score: number;
  timestamp: number;
}

export interface TicketSentiment {
  ticketId: string;
  score: SentimentRange;
  lastUpdated: string;
}

export const DEFAULT_SENTIMENT: SentimentRange = 0;
export const MIN_SENTIMENT: SentimentRange = -1;
export const MAX_SENTIMENT: SentimentRange = 1;
