import { ApiCredentials, Sentiment, Comment } from '../types';

let accessToken: string | null = null;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export async function initializeApp(zafClient: any): Promise<void> {
  try {
    const metadata = await zafClient.metadata();
    const appId = metadata.appId;
    
    const response = await fetch(`${BACKEND_URL}/api/oauth/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app_id: appId }),
      mode: 'no-cors',
    });
    
    // Since 'no-cors' mode doesn't allow reading the response,
    // we can't check if it's ok or parse the JSON.
    // Instead, we'll assume it worked if we got here without an error.
    setAccessToken('dummy_token');
  } catch (error) {
    console.error('Error during app initialization:', error);
    throw error;
  }
}

export async function analyzeSentiment(customerComments: Comment[]): Promise<Sentiment> {
  if (process.env.REACT_APP_LOCAL_DEV === 'true') {
    const sentiments: Sentiment[] = ['extremely positive', 'positive', 'neutral', 'negative', 'extremely negative'];
    const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    return randomSentiment;
  }

  if (!accessToken) {
    throw new Error('App not authenticated');
  }
  const response = await fetch(`${BACKEND_URL}/api/analyze-sentiment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerComments }),
  });
  if (!response.ok) {
    throw new Error('Failed to analyze sentiment');
  }
  const data = await response.json();
  return data.sentiment;
}

export function setAccessToken(token: string) {
  accessToken = token;
}