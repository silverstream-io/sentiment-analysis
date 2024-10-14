import { Sentiment, Comment } from '../types';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export async function initializeApp(zafClient: any): Promise<void> {
  // No need for OAuth initialization
  console.log('App initialized');
}

export async function analyzeSentiment(zafClient: any, customerComments: Comment[]): Promise<Sentiment> {
  if (process.env.REACT_APP_LOCAL_DEV === 'true') {
    const sentiments: Sentiment[] = ['extremely positive', 'positive', 'neutral', 'negative', 'extremely negative'];
    return sentiments[Math.floor(Math.random() * sentiments.length)];
  }

  try {
    const metadata = await zafClient.metadata();
    const subdomain = metadata.settings.subdomain;
    const apiKey = await zafClient.get('currentUser.settings.api_key');

    const response = await fetch(`${BACKEND_URL}/api/analyze-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Zendesk-Subdomain': subdomain
      },
      body: JSON.stringify({ customerComments }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze sentiment');
    }

    const data = await response.json();
    return data.sentiment;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    throw error;
  }
}
