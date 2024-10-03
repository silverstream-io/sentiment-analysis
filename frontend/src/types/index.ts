export type Sentiment = 'extremely positive' | 'positive' | 'neutral' | 'negative' | 'extremely negative';

interface ZendeskUser {
  id: number;
  email: string;
  role: string;
  name?: string;
  // Add other properties as optional
  [key: string]: any;
}

export interface Comment {
  id: number;
  type: string;
  value: string;
  author: ZendeskUser;
  created_at: string;
  // Keep other properties optional
  imageAttachments?: any[];
  nonImageAttachments?: any[];
  via?: {
    channel: string;
    source: {
      from: any;
      to: any;
      rel: string;
    };
  };
  metadata?: {
    system?: {
      client?: string;
      ip_address?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
    };
    custom?: Record<string, any>;
  };
}

export interface ApiCredentials {
  AUTHORIZED: boolean;
}