import React, { useEffect, useState } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog } from '../services/apiService';

interface SentimentAnalysisProps {
  zafClient: any;
  onSentimentUpdate: (ticketId: string | null, sentiment: number) => void;
}

const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({ zafClient, onSentimentUpdate }) => {
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        console.log('ticketCommentsData', ticketCommentsData);
        const ticketComments = ticketCommentsData['ticket.comments'];
        const customerComments = Array.isArray(ticketComments) 
          ? ticketComments.filter((comment: any) => comment.author.role === 'end-user')
          : [];

        console.log('customerComments', customerComments);
        const commentsToAnalyze: { [id: string]: string } = {};

        if (storedVectors.length === 0) {
          // If no vectors exist, analyze all customer comments
          customerComments.forEach((comment: any) => {
            commentsToAnalyze[comment.id] = comment.value;
          });
        } else {
          // Compare existing vectors with customer comments
          customerComments.forEach((comment: any) => {
            const commentVectorId = `${ticketId}#${comment.id}`;
            if (!storedVectors.some(vector => vector.id === commentVectorId)) {
              commentsToAnalyze[comment.id] = comment.value;
            }
          });
        }
        console.log('commentsToAnalyze', commentsToAnalyze);

        // Analyze new comments if any
        if (Object.keys(commentsToAnalyze).length > 0) {
          debugLog('Analyzing comments:', commentsToAnalyze);
          await analyzeComments(zafClient, ticketId, commentsToAnalyze);
        }

        // Get the updated score for the ticket
        const totalScore = await getScore(zafClient, ticketId);
        debugLog('Total score:', totalScore);
        setScore(totalScore);
        onSentimentUpdate(ticketId, totalScore);
      } catch (error) {
        console.error('Error analyzing sentiment:', error);
        setError(error instanceof Error ? error.message : 'An unknown error occurred');
      }
    }

    analyzeSentiment();
  }, [zafClient, onSentimentUpdate]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      {score !== null ? (
        <div>Sentiment Score: {score.toFixed(2)}</div>
      ) : (
        <div>Analyzing sentiment...</div>
      )}
    </div>
  );
};

export default SentimentAnalysis;
