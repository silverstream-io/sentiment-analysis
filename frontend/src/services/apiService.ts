import Cookies from 'js-cookie';
import { SentimentRange, DEFAULT_SENTIMENT } from '../types';
const BACKEND_URL = 'https://api.silverstream.io/sentiment-checker';
const DEBUG = process.env.REACT_APP_DEBUG === 'true';

let originalQueryString = '';

export async function initializeApp(zafClient: any, queryString: string): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  originalQueryString = queryString;
  debugLog('App initialized');
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const sessionToken = Cookies.get('session_token');
  debugLog('Session token in cookie:', sessionToken);

  const url = new URL(`${BACKEND_URL}${endpoint}`);
  url.search = originalQueryString;

  debugLog(`Trying to fetch ${url.toString()} with method ${method}`);
  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      errorLog(`API request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    debugLog(`API response from ${url.toString()}:`, responseData);
    return responseData;
  } catch (error) {
    debugLog(`API request failed: ${error}`);
    throw error;
  }
}

export async function listTicketVectors(zafClient: any, ticketId: string): Promise<any[]> {
  debugLog('Listing ticket vectors for ticket:', ticketId);
  const data = await makeApiRequest(zafClient, '/get-ticket-vectors', 'POST', { tickets: [ticketId] });
  if (data.vectors && typeof data.vectors === 'object') {
    return data.vectors[ticketId] || [];
  } else if (data.Error) {
    errorLog('Error fetching vectors:', data.Error);
    return [];
  } else {
    errorLog('Unexpected response from API:', data);
    return [];
  }
}

export async function analyzeComments(zafClient: any, ticketId: string, ticketComments: any): Promise<void> {
  debugLog('Analyzing comments for ticket:', ticketId, ticketComments);
  const formattedComments: { [commentId: string]: { text: string, created_at: string } } = {};
  
  ticketComments['ticket.comments'].forEach((comment: any) => {
    formattedComments[comment.id] = {
      text: comment.value,
      created_at: comment.created_at || new Date().toISOString()
    };
  });

  await makeApiRequest(zafClient, '/analyze-comments', 'POST', { 
    tickets: { 
      [ticketId]: { 
        comments: formattedComments 
      }
    } 
  });
}

export async function getScore(zafClient: any, ticketIds: string | string[] | { ticketId: string }): Promise<SentimentRange> {
  debugLog('Getting score for tickets:', ticketIds);
  let formattedTickets: string[];
  if (Array.isArray(ticketIds)) {
    formattedTickets = ticketIds;
  } else if (typeof ticketIds === 'object' && 'ticketId' in ticketIds) {
    formattedTickets = [ticketIds.ticketId];
  } else {
    formattedTickets = [ticketIds as string];
  }
  const data = await makeApiRequest(zafClient, '/get-score', 'POST', { tickets: formattedTickets });
  debugLog('Score data:', data.score);
  return data.score;
}

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}

export function errorLog(...args: any[]) {
  console.error('[ERROR]', ...args);
}

export function infoLog(...args: any[]) {
  console.info('[INFO]', ...args);
}

export function warnLog(...args: any[]) {
  console.warn('[WARN]', ...args);
} 

export async function getLast30DaysSentiment(zafClient: any): Promise<SentimentRange> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const ticketData = await zafClient.get('ticket');
  const requesterId = ticketData.ticket.requester.id;

  const searchResponse = await zafClient.request({
    url: '/api/v2/search.json',
    type: 'GET',
    data: {
      query: `type:ticket created>${thirtyDaysAgo.toISOString()} requester:${requesterId}`,
    },
  });

  const ticketIds = searchResponse.results.map((result: any) => result.id);
  
  if (ticketIds.length === 0) {
    warnLog('No ticket IDs found for last 30 days');
    return DEFAULT_SENTIMENT;
  } else {
    debugLog('Ticket IDs for last 30 days:', ticketIds);
  }
  return await getScore(zafClient, ticketIds);
}
