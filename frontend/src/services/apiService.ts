import { ApiCredentials } from '../types';

let accessToken: string | null = null;

export async function initializeApp(zafClient: any): Promise<void> {
  const appData = await zafClient.get('appData');
  const installationId = appData.installation_id;
  
  const response = await fetch('/api/oauth/initiate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ installation_id: installationId }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to initiate OAuth flow');
  }
  
  const { authorizationUrl } = await response.json();
  window.open(authorizationUrl, '_blank');
}

export async function fetchApiCredentials(): Promise<ApiCredentials> {
  if (!accessToken) {
    throw new Error('App not authenticated');
  }
  const response = await fetch('/api/credentials', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch API credentials');
  }
  return response.json();
}

export function setAccessToken(token: string) {
  accessToken = token;
}