export type Sentiment = -2 | -1 | 0 | 1 | 2;

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