import React, { useEffect, useState } from 'react';
import { PineconeService } from '../services/pineconeService';
import { OpenAIService } from '../services/openAIService';
import { analyzeSentiment } from '../utils/sentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';
import { Comment, Sentiment, ApiCredentials } from '../types';
import { fetchApiCredentials } from '../services/apiService';

interface AppProps {
  pineconeService: PineconeService;
}

const App: React.FC<AppProps> = ({ pineconeService }) => {
  const [client, setClient] = useState<any | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment>('neutral');
  const [apiCredentials, setApiCredentials] = useState<ApiCredentials | null>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js';
    script.async = true;
    script.onload = initializeApp;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initializeApp = async () => {
    const zafClient = await ZAFClient.init();
    setClient(zafClient);

    await initializeApp();
    const credentials = await fetchApiCredentials();
    setApiCredentials(credentials);

    zafClient.on('ticket.updated', handleTicketUpdate);
    zafClient.invoke('resize', { width: '100%', height: '200px' });

    const context = await zafClient.context();
    setTicketId(context.ticketId);
  };

  useEffect(() => {
    if (client && ticketId) {
      updateSentiment();
    }
  }, [client, ticketId]);

  const handleTicketUpdate = async () => {
    if (client) {
      const context = await client.context();
      setTicketId(context.ticketId);
      updateSentiment();
    }
  };

  const storeComment = async (ticketId: string, text: string, isCustomer: boolean) => {
    const embedding = await OpenAIService.getEmbedding(text);
    const commentIndex = await pineconeService.getNextCommentIndex(ticketId);
    const metadata = {
      text,
      timestamp: new Date().toISOString(),
      author: isCustomer ? 'customer' : 'agent',
    };

    await pineconeService.upsertVector(`${ticketId}#${commentIndex}`, embedding, metadata);
  };

  const updateSentiment = async () => {
    if (!ticketId || !client) return;

    try {
      const ticket = await client.get('ticket');
      const comments: Comment[] = await client.get('ticket.comments');

      const customerComments = comments
        .filter(comment => comment.author.role === 'end-user')
        .map(comment => ({ text: comment.text, author: comment.author, isCustomer: true }));

      const newSentiment = await analyzeSentiment(customerComments);
      setSentiment(newSentiment);

      // Store the latest comment
      const latestComment = comments[comments.length - 1];
      await storeComment(ticketId, latestComment.text, latestComment.author.role === 'end-user');
    } catch (error) {
      console.error('Error fetching ticket comments:', error);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">SatCom Sentiment Analysis</h1>
      <SentimentDisplay sentiment={sentiment} />
    </div>
  );
};

export default App;