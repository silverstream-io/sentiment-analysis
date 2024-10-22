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

      const ticketId = await zafClient.context('ticketId');
      debugLog('Analyzing sentiment for ticket:', ticketId);

      // Get all vectors associated with the current ticket
      const storedVectors = await listTicketVectors(zafClient, ticketId);
      
      // Get all customer comments
      const ticketCommentsData = await zafClient.get('ticket.comments');
      debugLog('ticketCommentsData', ticketCommentsData);
      const ticketComments = ticketCommentsData['ticket.comments'];
      const customerComments = Array.isArray(ticketComments) 
        ? ticketComments.filter((comment: any) => comment.author.role === 'end-user')
        : [];

      debugLog('customerComments', customerComments);
      const commentsToAnalyze: { [id: string]: { text: string, created_at: Date } } = {};

      debugLog('storedVectors', storedVectors);
      debugLog('storedVectors.length', storedVectors.length);
      if (storedVectors.length === 0 || storedVectors.length === undefined) {
        // If no vectors exist, analyze all customer comments
        customerComments.forEach((comment: any) => {
          commentsToAnalyze[comment.id] = {
            text: comment.value,
            created_at: new Date(comment.created_at)
          };
        });
      } else {
        // Compare existing vectors with customer comments
        customerComments.forEach((comment: any) => {
          const commentVectorId = `${ticketId}#${comment.id}`;
          if (!storedVectors.some(vector => vector.id === commentVectorId)) {
            commentsToAnalyze[comment.id] = {
              text: comment.value,
              created_at: new Date(comment.created_at)
            };
          }
        });
      }
      debugLog('commentsToAnalyze', commentsToAnalyze);

      // Analyze new comments if any
      if (Object.keys(commentsToAnalyze).length > 0) {
        debugLog('Analyzing comments:', commentsToAnalyze);
        await analyzeComments(zafClient, ticketId, commentsToAnalyze);
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
