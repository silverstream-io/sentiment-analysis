import React, { useEffect, useState } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog, getLast30DaysSentiment, errorLog } from '../services/apiService';

interface SentimentAnalysisProps {
  zafClient: any;
  onSentimentUpdate: (ticketId: string | null, sentiment: number) => void;
}

const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({ zafClient, onSentimentUpdate }) => {
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

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
      setIsAnalyzing(true);
      rotateMessages();

      const ticketIdObject = await zafClient.get('ticket.id');
      const ticketId = ticketIdObject['ticket.id'];
      debugLog('Analyzing sentiment for ticket:', ticketId);

      const ticketComments = await zafClient.get('ticket.comments');
      if (ticketComments['ticket.comments'].length === 0) {
        debugLog('No comments found for ticket:', ticketId);
        return "No comments found, check back later.";
      }
      debugLog('ticketComments', ticketComments);

      // Fetch ticket details to get comment creation times
      const ticketDetails = await zafClient.request({
        url: `/api/v2/tickets/${ticketId}/comments.json`,
        type: 'GET'
      });

      let commentCreationTimes: { [id: string]: string } = {};

      if (ticketDetails && ticketDetails.comments && Array.isArray(ticketDetails.comments)) {
        for (const comment of ticketDetails.comments) {
          if (comment && comment.id && comment.created_at) {
            commentCreationTimes[comment.id] = comment.created_at;
          }
        }
      } else {
        debugLog('Unexpected structure in ticketDetails:', ticketDetails);
        throw new Error('Unexpected structure in ticketDetails: ' + JSON.stringify(ticketDetails));
      }

      // Get all vectors associated with the current ticket
      const storedVectors = await listTicketVectors(zafClient, ticketId);
      debugLog('storedVectors', storedVectors);

      if (Object.keys(storedVectors).length === 0) {
        debugLog('No vectors found for ticket:', ticketId);
        // Create vectors for every comment on the ticket
        await analyzeComments(zafClient, ticketId, ticketComments);
      } else {
        // Analyze new comments if any
        const newComments = ticketComments['ticket.comments'].filter((comment: any) => 
          !Object.values(storedVectors).some((vector: any) => vector.id === `${ticketId}#${comment.id}`)
        );
        if (newComments.length > 0) {
          debugLog('Analyzing new comments:', newComments);
          await analyzeComments(zafClient, ticketId, { 'ticket.comments': newComments });
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

  const rotateMessages = () => {
    const messages = [
      'Analyzing ticket sentiment...',
      'Getting list of comments...',
      'Scoring sentiment of each comment...',
      'Comparing to tickets over the last 30 days...'
    ];
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      setAnalysisMessage(messages[currentIndex]);
      currentIndex = (currentIndex + 1) % messages.length;
    }, 2500); // Change message every 2.5 seconds

    // Clear the interval after 10 seconds
    setTimeout(() => clearInterval(intervalId), 10000);
  };

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (isAnalyzing) {
    return <div>{analysisMessage}</div>;
  }

  return null;
};

export default SentimentAnalysis;
