import { Sentiment, Comment } from '../types';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export async function initializeApp(zafClient: any): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  console.log('App initialized');
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const metadata = await zafClient.metadata();
  const subdomain = metadata.settings.subdomain;
  
  // Get the ZAF JWT token
  const jwt = await zafClient.get('jwt');

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
      'X-Zendesk-Subdomain': subdomain
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

export async function listTicketVectors(zafClient: any, ticketId: string): Promise<string[]> {
  const data = await makeApiRequest(zafClient, '/api/get-ticket-vectors', 'POST', { ticket_id: ticketId });
  return data.vectors;
}

export async function analyzeComments(zafClient: any, ticketId: string, comments: { [id: string]: string }): Promise<void> {
  await makeApiRequest(zafClient, '/api/analyze-comments', 'POST', { ticket_id: ticketId, comments });
}

export async function getScore(zafClient: any, ticketId: string): Promise<number> {
  const data = await makeApiRequest(zafClient, '/api/get-score', 'POST', { ticket_id: ticketId });
  return data.score;
}
