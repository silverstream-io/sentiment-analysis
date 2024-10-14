import React, { useEffect, useState } from 'react';
import { listTicketVectors, analyzeComments, getScore } from '../services/apiService';

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

        const ticketId = await zafClient.get('ticket.id');
        const storedVectors = await listTicketVectors(zafClient, ticketId);
        const ticketComments = await zafClient.get('ticket.comments');
        
        const missingComments: { [id: string]: string } = {};
        ticketComments.forEach((comment: any) => {
          if (!storedVectors.includes(`${ticketId}#${comment.id}`)) {
            missingComments[comment.id] = comment.value;
          }
        });

        if (Object.keys(missingComments).length > 0) {
          await analyzeComments(zafClient, ticketId, missingComments);
        }

        const totalScore = await getScore(zafClient, ticketId);
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
    return <div className="error-message">Error: {error}. Please check your API key and try again.</div>;
  }

  if (score === null) {
    return <div>Loading sentiment analysis...</div>;
  }

  const calculateAngle = (score: number) => {
    return (score + 2) * 45;
  };

  const angle = calculateAngle(score);

  return (
    <div className="sentiment-display" style={{ transform: `rotate(${angle}deg)` }}>
      {/* Add your sentiment display UI here */}
    </div>
  );
};

export default SentimentAnalysis;
