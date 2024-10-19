import { formatDiagnostic } from 'typescript'; import { Sentiment, Comment } from '../types';
import { getCookie, setCookie } from './cookieService';

const BACKEND_URL = 'https://api.silverstream.io';
// const BACKEND_URL = 'https://silverstream.onrender.com';
// const BACKEND_URL = 'http://localhost:4000';
const DEBUG = process.env.REACT_APP_DEBUG === 'true';

export async function initializeApp(zafClient: any): Promise<void> {
  if (!zafClient) {
    throw new Error('ZAFClient is not initialized');
  }
  console.log('App initialized');
}

async function makeApiRequest(zafClient: any, endpoint: string, method: string, body?: any) {
  const context = await zafClient.context();
  const subdomain = context.account.subdomain;

  debugLog(`Making API request to ${BACKEND_URL}${endpoint}`, { method, subdomain, body });

  const formData = new FormData();

  if (body) {
    for (const key in body) {
      formData.append(key, JSON.stringify(body[key]));
    }
  }

  const token = getCookie('token');
  console.log('Token in cookie:', token);
  const headers: HeadersInit = {
    'X-Zendesk-Subdomain': subdomain,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  debugLog(`Trying to fetch ${BACKEND_URL}${endpoint} with method ${method}`);
  debugLog(`With form data: ${formData}`);
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method,
      headers,
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      debugLog(`API request failed: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    // Check if the response includes a new token
    const newToken = response.headers.get('X-JWT-Token');
    if (newToken) {
      setCookie('jwt_token', newToken, { secure: true, sameSite: 'strict' });
    }

    debugLog(`API response from ${BACKEND_URL}${endpoint}:`, responseData);
    return responseData;
  } catch (error) {
    debugLog(`API request failed: ${error}`);
    throw error;
  }
}

export async function listTicketVectors(zafClient: any, ticketId: string): Promise<string[]> {
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
