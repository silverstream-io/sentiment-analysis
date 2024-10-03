export type Sentiment = 'extremely positive' | 'positive' | 'neutral' | 'negative' | 'extremely negative';

export interface Comment {
  author: any;
  text: string;
  isCustomer: boolean;
}

export interface ApiCredentials {
  PINECONE_API_KEY: string | null;
  PINECONE_INDEX_NAME: string | null;
  PINECONE_NAMESPACE: string | null;
  OPENAI_API_KEY: string | null;
  AUTHORIZED: boolean;
}