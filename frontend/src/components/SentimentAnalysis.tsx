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
        
        // Get the most recent customer comment
        const ticketComments = await zafClient.get('ticket.comments');
        const comments = Array.isArray(ticketComments) ? ticketComments : []; 
        const latestCustomerComment = comments
          .filter((comment: any) => comment.author.role === 'end-user')
          .pop();

        if (latestCustomerComment) {
          const latestCommentId = `${ticketId}#${latestCustomerComment.id}`;
          console.log('latestCommentId', latestCommentId);
          
          // Check if the latest comment is already analyzed
          if (!storedVectors.some(vector => vector.id === latestCommentId)) {
            debugLog('Analyzing latest comment:', latestCustomerComment.value);
            await analyzeComments(zafClient, ticketId, { [latestCustomerComment.id]: latestCustomerComment.value });
          }
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
