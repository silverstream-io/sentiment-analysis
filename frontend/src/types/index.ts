export type Sentiment = -2 | -1 | 0 | 1 | 2;

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