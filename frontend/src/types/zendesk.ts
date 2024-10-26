export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ZendeskTicket {
  id: number;
  subject: string;
  description: string;
  status: ZendeskTicketStatus;
  requester_id: number;
  assignee_id: number;
  created_at: string;
  updated_at: string;
}

export interface ZendeskComment {
  id: number;
  type: string;
  author_id: number;
  body: string;
  html_body: string;
  plain_body: string;
  created_at: string;
  updated_at: string;
}

export type ZendeskTicketStatus = 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';

// This is the simplified version we use for our API
export interface TicketData {
  id: string;
  state: ZendeskTicketStatus;
  updated_at: string;
  created_at: string;
  score?: number;
  subject?: string;  // Add this field
}
