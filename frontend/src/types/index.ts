export type Sentiment = -10 | -5 | 0 | 5 | 10;

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