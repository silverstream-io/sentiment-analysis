export type Sentiment = -10 | -5 | 0 | 5 | 10;

export type SentimentRange = number;

export const MIN_SENTIMENT: SentimentRange = -1;
export const MAX_SENTIMENT: SentimentRange = 1;

interface ZendeskUser {
  id: number;
  email: string;
  role: string;
  name?: string;
  // Add other properties as optional
  [key: string]: any;
}

export interface ApiCredentials {
  AUTHORIZED: boolean;
}
