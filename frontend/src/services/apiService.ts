import Cookies from 'js-cookie';
import { TicketData, SentimentRange, DEFAULT_SENTIMENT, ZendeskTicketStatus } from '../types';
const BACKEND_URL = 'https://api.silverstream.io/sentiment-checker';
const DEBUG = process.env.REACT_APP_DEBUG === 'true';

let originalQueryString = '';

export async function initializeApp(zafClient: any, originalQueryString: string): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  originalQueryString = originalQueryString;
  debugLog('App initialized');
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const sessionToken = Cookies.get('session_token');
  debugLog('Session token in cookie:', sessionToken);

  const url = new URL(`${BACKEND_URL}${endpoint}`);
  const searchParams = new URLSearchParams(originalQueryString);
  searchParams.set('subdomain', subdomain);
  url.search = searchParams.toString();

  debugLog(`Trying to fetch ${url.toString()} with method ${method}`);
  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Zendesk-Subdomain': subdomain,
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
        comments: formattedComments,
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

export async function getScores(zafClient: any, ticketIds: string[]): Promise<{ [key: string]: number }> {
  debugLog('Getting scores for tickets:', ticketIds);
  const data = await makeApiRequest(zafClient, '/get-scores', 'POST', { tickets: ticketIds });
  debugLog('Scores data:', data.scores);
  return data.scores;
}

// Add this new function
export async function updateTicketSentiment(zafClient: any, ticketData: TicketData): Promise<void> {
  debugLog('Updating ticket sentiment:', ticketData);
  try {
    // Get ticket comments
    const ticketComments = await zafClient.get('ticket.comments');
    
    await makeApiRequest(zafClient, '/analyze-comments', 'POST', {
      ticket: {
        id: ticketData.id,
        state: ticketData.state,
        updated_at: ticketData.updated_at,
        created_at: ticketData.created_at,
        comments: ticketComments['ticket.comments']
      }
    });
  } catch (error) {
    errorLog('Error updating ticket sentiment:', error);
    throw error;
  }
}

interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next_page?: string;
  previous_page?: string;
}

export async function getUnsolvedTickets(
  zafClient: any, 
  page: number = 1, 
  perPage: number = 10
): Promise<PaginatedResponse<TicketData>> {
  debugLog('Getting unsolved tickets', { page, perPage });
  try {
    // Get unsolved tickets from Zendesk API with pagination
    const response = await zafClient.request({
      url: `/api/v2/search.json?query=type:ticket status<solved&page=${page}&per_page=${perPage}`,
      type: 'GET'
    });

    if (!response || !response.results) {
      throw new Error('Invalid response from Zendesk API');
    }

    // Map Zendesk response to TicketData
    const tickets: TicketData[] = response.results.map((ticket: any) => ({
      id: ticket.id.toString(),
      state: ticket.status as ZendeskTicketStatus,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at
    }));

    debugLog('Found unsolved tickets:', tickets);
    
    return {
      results: tickets,
      count: response.count || 0,
      next_page: response.next_page,
      previous_page: response.previous_page
    };
  } catch (error) {
    errorLog('Error getting unsolved tickets:', error);
    throw error;
  }
}

export async function getUnsolvedTicketsFromCache(
  zafClient: any,
  page: number = 1,
  perPage: number = 10
): Promise<PaginatedResponse<TicketData>> {
  debugLog('Getting unsolved tickets from cache', { page, perPage });
  try {
    // Get cached unsolved tickets from our backend API
    const response = await makeApiRequest(zafClient, '/get-unsolved-tickets', 'GET', {
      page,
      per_page: perPage
    });

    if (!response || !response.tickets) {
      throw new Error('Invalid response from cache API');
    }

    // Map cached response to TicketData
    const tickets: TicketData[] = response.tickets.map((ticket: any) => ({
      id: ticket.id.toString(),
      state: ticket.state,
      score: ticket.score,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at
    }));

    debugLog('Found cached unsolved tickets:', tickets);
    
    return {
      results: tickets,
      count: response.total_count || 0,
      next_page: page * perPage < response.total_count ? (page + 1).toString() : undefined,
      previous_page: page > 1 ? (page - 1).toString() : undefined
    };
  } catch (error) {
    errorLog('Error getting cached unsolved tickets:', error);
    throw error;
  }
}
