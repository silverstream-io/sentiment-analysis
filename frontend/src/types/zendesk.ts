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
  status: ZendeskTicketStatus | null;
  created_at: string | null;
  updated_at: string | null;
  score?: number | null;
  subject?: string | null;
  requester?: {
    id: string;
  } | null;
  assignee?: {
    id: string;
  } | null;
  comments?: Array<{
    id?: string;
    text?: string;
    createdAt?: string;
  }> | null;
}

export interface TicketWithDetails extends TicketData {
  requester?: {
    id: string;
    name: string;
    email: string;
  } | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface TicketResponse extends TicketData {
  comments: Array<CommentResponse>;
  weighted_score: number;
}

export interface CommentData {
  id: string;
  body: string;
  created_at: string;
  html_body: string;
  plain_body: string;
  author_id: number;
  public: boolean;
  ticket_requester_id: number | null;
  ticket_assignee_id: number | null;
}

export interface CommentResponse extends CommentData {
  score: number;
}

export interface CommentInput {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  ticket_requester_id?: string | null;
  ticket_assignee_id?: string | null;
}