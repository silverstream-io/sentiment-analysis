import Cookies from 'js-cookie';
import { 
  DEFAULT_SENTIMENT, 
  SentimentRange, 
  TicketData, 
  ZendeskTicketStatus, 
  CommentData, 
  TicketResponse
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

export async function initializeApp(zafClient: any, queryString: string): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  originalQueryString = queryString;  // Fix variable shadowing
  debugLog('App initialized with query string:', queryString);
}

function validateTicketRequestBody(body: any): { tickets: TicketData[] } {
  if (!body || !body.tickets || !Array.isArray(body.tickets)) {
    throw new Error(`Invalid request body: missing tickets array ${body}`);
  }
  
  const tickets = body.tickets.map((ticket: any) => {
    // Ensure id is present and is a string
    if (!ticket.id) {
      throw new Error(`Invalid ticket data: missing id ${JSON.stringify(ticket)}`);
    }
    
    return {
      id: ticket.id.toString(),
      comments: ticket.comments || null,
      status: ticket.status || null,
      created_at: ticket.created_at || null,
      updated_at: ticket.updated_at || null,
      requester: ticket.requester || null,
      assignee: ticket.assignee || null
    };
  });

  return { tickets };
}

function validateCommentRequestBody(body: any): { tickets: TicketData[] } {
  // Ensure comment ids are strings
  body.tickets.comments.forEach((comment: any) => {
    comment.id = comment.id.toString();
  });
  return body;
}

type ApiRequestType = 'TICKET' | 'SYSTEM';

async function makeApiRequest(
  zafClient: any, 
  endpoint: string, 
  method: string, 
  body?: any,
  requestType: ApiRequestType = 'TICKET'
) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  // Only validate ticket-related POST requests that have a body
  if (method === 'POST' && requestType === 'TICKET' && body && !body.token) {
    body = validateTicketRequestBody(body);
    if (body.tickets.comments) {
      body = validateCommentRequestBody(body);
    }
  }

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const searchParams = new URLSearchParams(originalQueryString);
  searchParams.set('subdomain', subdomain);
  
  // For GET requests, add body params to URL
  if (method === 'GET' && body) {
    Object.entries(body).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item: any) => searchParams.append(key, JSON.stringify(item)));
      } else {
        searchParams.set(key, JSON.stringify(value));
      }
    });
  }
  
  const url = `${BACKEND_URL}${endpoint}?${searchParams.toString()}`;
  const headers: Record<string, string> = {
    ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    'X-Zendesk-Subdomain': subdomain,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      errorLog(`API request failed: ${url} ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${url} {response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    debugLog(`API response from ${url}:`, responseData);
    return responseData;
  } catch (error) {
    debugLog(`API request failed: ${error}`);
    throw error;
  }
}

export async function listTicketVectors(zafClient: any, ticketData: TicketData): Promise<any[]> {
  if (!ticketData || !ticketData.id) {
    throw new Error('Ticket ID is required to list ticket vectors');
  }
  const ticketInput = {
    id: ticketData.id,
    comments: null,
    status: null,
    created_at: null,
    updated_at: null,
    requester: null,
    assignee: null
  };
  
  const data = await makeApiRequest(zafClient, '/get-ticket-vectors', 'POST', { tickets: [ticketInput] });
  return data;
}

export async function getTicketComments(zafClient: any, id: string): Promise<any[]> {
  debugLog('Getting ticket comments for ticket:', id);
  const ticketComments = await zafClient.request({
    url: `/api/v2/tickets/${id}/comments`,
    type: 'GET'
  });
  return ticketComments.comments;
}

export async function getTicketCountData(zafClient: any): Promise<any> {
  const data = await zafClient.request({
    url: '/api/v2/tickets/count',
    type: 'GET'
  });
  return data;
}

export async function getTicketVectorCountData(zafClient: any): Promise<any> {
  const data = await makeApiRequest(
    zafClient, 
    '/get-ticket-count', 
    'GET', 
    undefined,
    'SYSTEM'
  );
  return data;
}

export async function analyzeComments(zafClient: any, ticketData: TicketData): Promise<TicketResponse> {
  debugLog('Analyzing comments for ticket:', ticketData.id, ticketData);

  const response = await makeApiRequest(zafClient, '/analyze-comments', 'POST', { tickets: [ticketData] });
  return response;
}

export async function getScore(
  zafClient: any, 
  ticketData: TicketData | TicketData[]
): Promise<TicketResponse> {
  debugLog('Getting score for ticket:', ticketData);
  
  const tickets = Array.isArray(ticketData) ? ticketData : [ticketData];
  const response = await makeApiRequest(zafClient, '/get-score', 'POST', { tickets });
  debugLog('Score data:', response);
  return response;
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

export async function getLast30DaysSentiment(zafClient: any, ticketData: TicketData): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const requesterId = ticketData.requester?.id;

  const query = `type:ticket created>${thirtyDaysAgo.toISOString()} requester:${requesterId}`;
  const searchResponse = await zafClient.request({
    url: `/api/v2/search.json?query=${query}`,
    type: 'GET',
  });

  const ticketResults: TicketData[] = searchResponse.results.map((result: any) => ({
    id: result.id,
    status: result.status,
    created_at: result.created_at,
    updated_at: result.updated_at,
    requester: result.requester ? { id: result.requester.id } : null,
    assignee: result.assignee ? { id: result.assignee.id } : null
  }));
  
  if (ticketResults.length === 0) {
    warnLog('No ticket IDs found for last 30 days');
    warnLog('ticketResults:', ticketResults);
    warnLog('query:', query)
    return DEFAULT_SENTIMENT;
  } else {
    debugLog('Ticket IDs for last 30 days:', ticketResults.map((result: any) => result.id));
  }
  const thirtyDayScore = await getScore(zafClient, ticketResults);
  if (!thirtyDayScore) {
    errorLog('getScore returned non-array:', thirtyDayScore);
    return DEFAULT_SENTIMENT;
  }
  return thirtyDayScore.score || DEFAULT_SENTIMENT;
}

export async function getScores(zafClient: any, ticketData: TicketData[]): Promise<TicketResponse[]> {
  debugLog('Getting scores for tickets:', ticketData);
  try {
    const response = await makeApiRequest(zafClient, '/get-scores', 'POST', { tickets: ticketData });
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
    await makeApiRequest(zafClient, '/remove-ticket-from-cache', 'POST', {
      tickets: [{
        id: ticketData.id,
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
  startTimestamp?: string,
  excludeIds?: Set<string>
): Promise<PaginatedResponse<TicketData>> {
  debugLog('Getting unsolved tickets', { page, perPage, startTimestamp, excludeIds });
  try {
    const context = await zafClient.context();
    const subdomain = context.account.subdomain;

    // Build exclusion string if we have IDs to exclude
    const exclusionString = excludeIds && excludeIds.size > 0 
      ? excludeIds.size < 100  // Zendesk has query length limits
        ? ` ${Array.from(excludeIds).map(id => `-id:${id}`).join(' ')}`
        : ` -id:<${Array.from(excludeIds).join(',')}` // Use less-than operator for large sets
      : '';

    const response = await zafClient.request({
      url: `/api/v2/search.json?query=type:ticket status<solved${exclusionString}&page=${page}&per_page=${perPage}${startTimestamp ? `&created_at>=${startTimestamp}` : ''}`,
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
      requester: ticket.requester ? {
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

export async function getUnsolvedTicketsFromCache(zafClient: any, page: number = 1, perPage: number = 100): Promise<{ results: TicketData[] }> {
  debugLog('Getting unsolved tickets from cache');
  const cacheResults: TicketData[] = [];
  const cachedTicketIds = new Set<string>();
  
  try {
    let hasMore = true;
    while (hasMore) {
      // Try cache first
      const response = await makeApiRequest(
        zafClient, 
        '/get-unsolved-tickets', 
        'POST',
        { page, perPage },
      'SYSTEM'
    );
      debugLog('Cache response:', response);
      
      if (response.tickets) {
        response.tickets.forEach((ticket: TicketData) => {
          cacheResults.push(ticket);
          cachedTicketIds.add(ticket.id);
        });
      }
      
      hasMore = response.has_more;
      page++;
    }
  } catch (error) {
    errorLog('Cache error, falling back to direct API:', error);
  }

  // If we have cached results, only search for non-cached tickets
  let apiResults: TicketData[] = [];
  if (cachedTicketIds.size > 0) {
    let hasMore = true;
    page = 1; // Reset page for API search
    
    while (hasMore) {
      const response = await getUnsolvedTickets(zafClient, page, 100);
      
      // Filter out tickets we already have in cache
      const newTickets = response.results.filter(ticket => !cachedTicketIds.has(ticket.id));
      apiResults = [...apiResults, ...newTickets];
      
      hasMore = response.next_page !== null && response.next_page !== undefined;
      page++;
      
      debugLog(`Loaded ${apiResults.length} new tickets from API...`);
    }
  }

  const allTickets = [...cacheResults, ...apiResults];
  return {
    results: allTickets,
  };
}

export async function getComments(zafClient: any, ticket: TicketData): Promise<CommentData[]> {
  if (!window.APP_CONTEXT?.needsTicketContext) {
    throw new Error('Ticket context not available in current view');
  }
  const comments = await getTicketComments(zafClient, ticket.id);
  return comments.map((comment: any) => ({
    id: String(comment.id),
    body: comment.body || comment.html_body,
    created_at: comment.created_at,
    html_body: comment.html_body,
    plain_body: comment.plain_body,
    author_id: comment.author_id,
    public: comment.public,
    ticket_requester_id: ticket.requester ? Number(ticket.requester.id) : null,
    ticket_assignee_id: ticket.assignee ? Number(ticket.assignee.id) : null
  }));
}

export async function getTicket(zafClient: any): Promise<TicketData> {
  if (!window.APP_CONTEXT?.needsTicketContext) {
    throw new Error('Ticket context not available in current view');
  }

  try {
    const ticketData = await zafClient.get('ticket');
    if (ticketData['ticket'] && ticketData['ticket'].id) {
      return ticketData['ticket'];
    }
    throw new Error('No ticket ID found in response');
  } catch (err) {
    errorLog('Failed to get ticket ID:', err);
    throw new Error('Could not get ticket ID in current context');
  }
}

export async function checkNamespace(zafClient: any, subdomain: string): Promise<boolean> {
  try {
    const response = await makeApiRequest(
      zafClient, 
      '/check-namespace', 
      'POST', 
      { subdomain },
      'SYSTEM'
    );
    return response.exists;
  } catch (error) {
    errorLog('Error checking namespace:', error);
    return false;
  }
}

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