export type Sentiment = 'extremely positive' | 'positive' | 'neutral' | 'negative' | 'extremely negative';

export interface Comment {
  author: any;
  text: string;
  isCustomer: boolean;
}