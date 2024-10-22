import React, { useEffect, useState } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog, getLast30DaysSentiment, errorLog } from '../services/apiService';

interface SentimentAnalysisProps {
  zafClient: any;
  onSentimentUpdate: (ticketId: string | null, sentiment: number) => void;
}

const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({ zafClient, onSentimentUpdate }) => {
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    analyzeSentiment();

    // Set up event listener for new comments
    zafClient.on('ticket.comment.created', analyzeSentiment);

    // Clean up the event listener when the component unmounts
    return () => {
      zafClient.off('ticket.comment.created', analyzeSentiment);
    };
  }, [zafClient]);

  async function analyzeSentiment() {
    try {
      if (!zafClient) {
        throw new Error('ZAFClient is not initialized');
      }

      const ticketId = await zafClient.get('ticket.id');
      debugLog('Analyzing sentiment for ticket:', ticketId);

      const ticketComments = await zafClient.get('ticket.comments');
      debugLog('ticketComments', ticketComments);
      // Get all vectors associated with the current ticket
      const storedVectors = await listTicketVectors(zafClient, ticketId);
      debugLog('storedVectors', storedVectors);

      if (storedVectors.length === 0) {
        debugLog('No vectors found for ticket:', ticketId);
        // Create vectors for every comment on the ticket
        await analyzeComments(zafClient, ticketId, ticketComments);
      } else {
        // Analyze new comments if any
        const newComments = ticketComments.filter((comment: any) => !storedVectors.some((vector: any) => vector.id === `${ticketId}#${comment.id}`));
        if (newComments.length > 0) {
          debugLog('Analyzing new comments:', newComments);
          await analyzeComments(zafClient, ticketId, newComments);
        }
      }

      // Get the updated score for the current ticket
      const currentTicketScore = await getScore(zafClient, ticketId);
      debugLog('Current ticket score:', currentTicketScore);
      onSentimentUpdate(ticketId, currentTicketScore);

      // Get the sentiment for the last 30 days
      const last30DaysScore = await getLast30DaysSentiment(zafClient);
      debugLog('Last 30 days score:', last30DaysScore);
      onSentimentUpdate(null, last30DaysScore);

      setIsAnalyzing(false);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setIsAnalyzing(false);
    }
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (isAnalyzing) {
    return <div>Analyzing sentiment...</div>;
  }

  return null;
};

export default SentimentAnalysis;
