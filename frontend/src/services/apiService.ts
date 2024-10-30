import Cookies from 'js-cookie';
import { 
  DEFAULT_SENTIMENT, 
  SentimentRange, 
  TicketData, 
  TicketInput,
  TicketRequestData, 
  ZendeskTicketStatus, 
} from '../types';

declare global {
    interface Window {
        ENV: {
            BACKEND_URL: string;
            DEBUG: string;
        }
    }
}

const BACKEND_URL = window.ENV?.BACKEND_URL || '/sentiment-checker';
const DEBUG = window.ENV?.DEBUG === 'true';

let originalQueryString = '';  // Global variable

// Add a helper function at the top
function ensureIntId(id: string | number): number {
  return typeof id === 'string' ? parseInt(id, 10) : id;
}

export async function initializeApp(zafClient: any, queryString: string): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  originalQueryString = queryString;  // Fix variable shadowing
  debugLog('App initialized with query string:', queryString);
}

function validateRequestBody(body: any): TicketRequestData {
  if (!body || !body.tickets || !Array.isArray(body.tickets)) {
    throw new Error('Invalid request body: missing tickets array');
  }
  
  return {
    tickets: body.tickets.map((ticket: TicketInput) => ({
      ticketId: ensureIntId(ticket.ticketId),
      comments: ticket.comments || null
    }))
  };
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  // Validate body unless this is a form-data request (initial connection)
  if (body && !body.token) {
    body = validateRequestBody(body);
  }

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const searchParams = new URLSearchParams(originalQueryString);
  searchParams.set('subdomain', subdomain);
  
  const url = `${BACKEND_URL}${endpoint}?${searchParams.toString()}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Zendesk-Subdomain': subdomain,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      errorLog(`API request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    debugLog(`API response from ${url}:`, responseData);
    return responseData;
  } catch (error) {
    debugLog(`API request failed: ${error}`);
    throw error;
  }
}

export async function listTicketVectors(zafClient: any, ticketData: TicketInput): Promise<any[]> {
  const data = await makeApiRequest(zafClient, '/get-ticket-vectors', 'POST', { tickets: [ticketData] });
  return data
}

export async function getTicketComments(zafClient: any, ticketId: string | number): Promise<any[]> {
  const numericTicketId = ensureIntId(ticketId);
  debugLog('Getting ticket comments for ticket:', numericTicketId);
  if (zafClient.context().view.type === 'ticket_sidebar') {
    const commentEvents = await zafClient.get('ticket.comments');
    const comments = [];
    for (const comment of commentEvents['ticket.comments']) {
      const commentData = await zafClient.get('comment', { id: comment.id });
      comments.push(commentData);
    }
    return comments;
  } else {
    const ticketComments = await zafClient.request({
      url: `/api/v2/tickets/${numericTicketId}/comments`,
      type: 'GET'
    });
    return ticketComments.comments;
  }
}

export async function getTicketCountData(zafClient: any): Promise<any> {
  const data = await zafClient.request({
    url: '/api/v2/tickets/count',
    type: 'GET'
  });
  return data;
}

export async function getTicketVectorCountData(zafClient: any): Promise<any> {
  const data = await makeApiRequest(zafClient, '/get-ticket-count', 'GET');
  return data;
}

export async function analyzeComments(zafClient: any, ticketData: TicketInput): Promise<void> {
  const numericTicketId = ensureIntId(ticketData.ticketId);
  debugLog('Analyzing comments for ticket:', numericTicketId, ticketData);

  await makeApiRequest(zafClient, '/analyze-comments', 'POST', { tickets: [ticketData] });
}

export async function getScore(zafClient: any, ticketIds: string | string[] | { ticketId: string } | number | number[]): Promise<SentimentRange> {
  debugLog('Getting score for tickets:', ticketIds);
  let numericTicketIds: number[];
  
  if (Array.isArray(ticketIds)) {
    numericTicketIds = ticketIds.map(id => ensureIntId(id));
  } else if (typeof ticketIds === 'object' && 'ticketId' in ticketIds) {
    numericTicketIds = [ensureIntId(ticketIds.ticketId)];
  } else if (ticketIds) {
    numericTicketIds = [ensureIntId(ticketIds as string)];
  } else if (window.APP_CONTEXT?.needsTicketContext) {
    // Only try to get ticket ID if we're in a ticket context
    const currentTicketId = await getTicketId(zafClient);
    numericTicketIds = [currentTicketId];
  } else {
    numericTicketIds = [];  // Return empty array if no ticket context
  }

  const data = await makeApiRequest(zafClient, '/get-score', 'POST', { tickets: numericTicketIds });
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
  try {
    const numericTicketIds = ticketIds.map(id => ensureIntId(id));
    const ticketsResponse = await zafClient.request({
      url: `/api/v2/search.json?query=id:${numericTicketIds.join(' OR id:')}`,
      type: 'GET'
    });

    const ticketData = ticketsResponse.results.map((ticket: any) => ({
      id: ensureIntId(ticket.id),
      state: ticket.status as ZendeskTicketStatus,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      requestor: ticket.requester ? {
        id: ensureIntId(ticket.requester.id),
        name: ticket.requester.name
      } : undefined,
      assignee: ticket.assignee ? {
        id: ensureIntId(ticket.assignee.id),
        name: ticket.assignee.name
      } : undefined
    }));

    const response = await makeApiRequest(zafClient, '/get-scores', 'POST', {
      tickets: ticketData
    });
    return response.scores;
  } catch (error) {
    errorLog('Error getting scores:', error);
    throw error;
  }
}

// Add this new function
export async function removeTicketFromCache(zafClient: any, ticketData: TicketData): Promise<void> {
  debugLog('Removing ticket from cache:', ticketData);
  try {
    const numericTicketId = ensureIntId(ticketData.id);
    
    await makeApiRequest(zafClient, '/remove-ticket-from-cache', 'POST', {
      tickets: [{
        ticketId: numericTicketId,
      }]
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
  perPage: number = 25,
  startTimestamp?: string
): Promise<PaginatedResponse<TicketData>> {
  debugLog('Getting unsolved tickets', { page, perPage, startTimestamp });
  try {
    const context = await zafClient.context();
    const subdomain = context.account.subdomain;

    const response = await zafClient.request({
      url: `/api/v2/search.json?query=type:ticket status<solved&page=${page}&per_page=${perPage}${startTimestamp ? `&created_at>=${startTimestamp}` : ''}`,
      type: 'GET'
    });

    if (!response || !response.results) {
      throw new Error('Invalid response from Zendesk API');
    }

    // Map Zendesk response to TicketData with subject and URL
    const tickets: TicketData[] = response.results.map((ticket: any) => ({
      id: ticket.id.toString(),
      subject: ticket.subject,
      url: `https://${subdomain}.zendesk.com/agent/tickets/${ticket.id}`,
      state: ticket.status as ZendeskTicketStatus,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      requestor: ticket.requester ? {
        id: ticket.requester.id.toString(),
        name: ticket.requester.name
      } : undefined,
      assignee: ticket.assignee ? {
        id: ticket.assignee.id.toString(),
        name: ticket.assignee.name
      } : undefined
    }));

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

export async function getUnsolvedTicketsFromCache(zafClient: any): Promise<{ results: TicketData[] }> {
  debugLog('Getting unsolved tickets from cache');
  try {
    // Try cache first
    const response = await makeApiRequest(zafClient, '/get-unsolved-tickets', 'POST');
    debugLog('Cache response:', response);

    if (response?.results?.length > 0) {
      return {
        results: response.results
      };
    }

    // If cache fails or is empty, fall back to direct API and load all pages
    debugLog('Cache empty or failed, falling back to direct API');
    let allTickets: TicketData[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await getUnsolvedTickets(zafClient, page, 100);  // Get max per page
      allTickets = [...allTickets, ...response.results];
      
      // Check if there are more pages
      hasMore = response.next_page !== null && response.next_page !== undefined;
      page++;

      debugLog(`Loaded ${allTickets.length} tickets so far...`);
    }

    return {
      results: allTickets
    };

  } catch (error) {
    errorLog('Cache error, falling back to direct API:', error);
    // Same pagination logic for error fallback
    let allTickets: TicketData[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await getUnsolvedTickets(zafClient, page, 100);
      allTickets = [...allTickets, ...response.results];
      hasMore = response.next_page !== null && response.next_page !== undefined;
      page++;
    }

    return {
      results: allTickets
    };
  }
}

export async function getTicketId(zafClient: any): Promise<number> {
  if (!window.APP_CONTEXT?.needsTicketContext) {
    throw new Error('Ticket context not available in current view');
  }

  try {
    const ticketData = await zafClient.get('ticket.id');
    if (ticketData['ticket.id']) {
      return ensureIntId(ticketData['ticket.id']);
    }
    throw new Error('No ticket ID found in response');
  } catch (err) {
    errorLog('Failed to get ticket ID:', err);
    throw new Error('Could not get ticket ID in current context');
  }
}

export const checkNamespace = async (zafClient: any, subdomain: string): Promise<boolean> => {
  try {
    const response = await makeApiRequest(zafClient, '/check-namespace', 'POST', { subdomain });
      return response.exists;
    } catch (error) {
      errorLog('Error checking namespace:', error);
    return false;
  }
};

export const notifyApp = (zafClient: any, type: string, data: any) => {
  zafClient.request({
      url: '/api/v2/apps/notify',
      type: 'POST',
      data: {
        "app_id": process.env.ZAF_APP_ID,
        "event": "app_notification." + type,
        "body": data
      }
    });
  };