import React, { useEffect, useState } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog, getLast30DaysSentiment, errorLog, getTicketId } from '../services/apiService';
import { SentimentRange, MIN_SENTIMENT, MAX_SENTIMENT } from '../types';

interface SentimentAnalysisProps {
  zafClient: any;
  onSentimentUpdate: (ticketId: string | null, sentiment: SentimentRange) => void;
}

const SentimentAnalysis: React.FC<SentimentAnalysisProps> = ({ zafClient, onSentimentUpdate }) => {
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);

  useEffect(() => {
    analyzeSentiment();

    /* Turn off listener for new comments
    // Set up event listener for new comments
    zafClient.on('ticket.comment.created', analyzeSentiment);

    // Clean up the event listener when the component unmounts
    return () => {
      zafClient.off('ticket.comment.created', analyzeSentiment);
    };
    */
  }, [zafClient]);

  async function analyzeSentiment() {
    try {
      if (!zafClient) {
        throw new Error('ZAFClient is not initialized');
      }

      // Check if we need ticket context
      if (!window.APP_CONTEXT?.needsTicketContext) {
        debugLog('Skipping sentiment analysis - no ticket context needed');
        return;
      }

      setIsAnalyzing(true);
      //rotateMessages(); // Uncomment to see the rotating messages

      // Use getTicketId instead of direct ZAF client call
      const ticketId = await getTicketId(zafClient);
      debugLog('Analyzing sentiment for ticket:', ticketId);

      const ticketComments = await zafClient.get('ticket.comments');
      // Add guard for ticketComments
      if (!ticketComments || !ticketComments['ticket.comments']) {
        debugLog('No ticket comments data found');
        return "No comments found, check back later.";
      }

      // Add guard for comments array
      if (!Array.isArray(ticketComments['ticket.comments'])) {
        debugLog('Ticket comments is not an array:', ticketComments);
        return "Invalid comments data structure";
      }

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

      if (ticketDetails && ticketDetails.comments && Array.isArray(ticketDetails.comments)) {
        const detailedComments = new Map(ticketDetails.comments.map((comment: any) => [comment.id, comment.created_at]));
        ticketComments['ticket.comments'].forEach((comment: any) => {
          if (detailedComments.has(comment.id)) {
            comment.created_at = detailedComments.get(comment.id);
          }
        });
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
        if (Array.isArray(ticketComments['ticket.comments'])) {
          const newComments = ticketComments['ticket.comments'].filter((comment: any) => 
            !Object.values(storedVectors).some((vector: any) => vector.id === `${ticketId}#${comment.id}`)
          );
            if (newComments.length > 0) {
            debugLog('Analyzing new comments:', newComments);
            await analyzeComments(zafClient, ticketId, { 'ticket.comments': newComments });
          }
        } else {
          debugLog('Unexpected structure in ticketComments:', ticketComments);
          throw new Error('Unexpected structure in ticketComments: ' + JSON.stringify(ticketComments));
        }
      }

      // Get the updated score for the current ticket
      const currentTicketScore = await getScore(zafClient, ticketId);
      const normalizedCurrentScore = Math.max(MIN_SENTIMENT, Math.min(MAX_SENTIMENT, currentTicketScore)) as SentimentRange;
      debugLog('Current ticket score:', normalizedCurrentScore);
      onSentimentUpdate(ticketId.toString(), normalizedCurrentScore);

      // Get the sentiment for the last 30 days
      const last30DaysScore = await getLast30DaysSentiment(zafClient);
      const normalizedLast30DaysScore = Math.max(MIN_SENTIMENT, Math.min(MAX_SENTIMENT, last30DaysScore)) as SentimentRange;
      debugLog('Last 30 days score:', normalizedLast30DaysScore);
      onSentimentUpdate(null, normalizedLast30DaysScore);

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
