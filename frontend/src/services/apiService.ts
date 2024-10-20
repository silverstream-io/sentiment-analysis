import { formatDiagnostic } from 'typescript';
import { Sentiment, Comment } from '../types';
import Cookies from 'js-cookie';

const BACKEND_URL = 'https://api.silverstream.io/sentiment-checker';
const DEBUG = process.env.REACT_APP_DEBUG === 'true';

let originalQueryString = '';

export async function initializeApp(zafClient: any, queryString: string): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  originalQueryString = queryString;
  console.log('App initialized');
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const sessionToken = Cookies.get('session_token');
  console.log('Session token in cookie:', sessionToken);

  const url = new URL(`${BACKEND_URL}${endpoint}`);
  url.search = originalQueryString;

  debugLog(`Trying to fetch ${url.toString()} with method ${method}`);
  try {
    const response = await fetch(url.toString(), {
      method,
      body,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`API request failed: ${response.status} ${response.statusText}`, errorText);
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
  const data = await makeApiRequest(zafClient, '/api/get-ticket-vectors', 'POST', { ticket: { id: ticketId } });
  return data.vectors;
}

export async function analyzeComments(zafClient: any, ticketId: string, comments: { [id: string]: string }): Promise<void> {
  debugLog('Analyzing comments for ticket:', ticketId, comments);
  await makeApiRequest(zafClient, '/api/analyze-comments', 'POST', { ticket: { id: ticketId, comments } });
}

export async function getScore(zafClient: any, ticketId: string): Promise<number> {
  debugLog('Getting score for ticket:', ticketId);
  const data = await makeApiRequest(zafClient, '/api/get-score', 'POST', { ticket: { id: ticketId } });
  return data.score;
}

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}
