export interface ZendeskUser {
  id: number;
  name: string;
  email: string;
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
  created_at: string;
  updated_at: string;
  score?: number;
  subject?: string;
  requestor?: {
    id: number;
    name: string;
  };
  assignee?: {
    id: number;
    name: string;
  };
}

export interface TicketRequestData {
  tickets: Array<{
    ticketId: number;
    comments?: Array<{
      id?: string;
      text?: string;
      created_at?: string;
    }>;
  }>;
}

export interface TicketInput {
  ticketId: string | number;
  comments?: Array<{
    commentId?: string;
    text?: string;
    createdAt?: string;
  }>;
}
