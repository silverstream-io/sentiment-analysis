import React, { useEffect, useState } from 'react';
import { 
  analyzeComments, 
  getScore, 
  debugLog, 
  getLast30DaysSentiment, 
  errorLog, 
  getTicket,
  getComments
} from '../services/apiService';
import { SentimentRange, TicketData, CommentData, MIN_SENTIMENT, MAX_SENTIMENT } from '../types';

interface SentimentAnalysisProps {
  zafClient: any;
  onSentimentUpdate: (id: string | null, sentiment: SentimentRange) => void;
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

      const ticket = await getTicket(zafClient);
      debugLog('Analyzing sentiment for ticket:', ticket.id);
      if (!ticket || !ticket.id ) {
        throw new Error(`No ticket data found ${ticket}`);
      }

      const comments = await getComments(zafClient, ticket);
      if (!comments || comments.length === 0) {
        debugLog('No comments found, check back later.');
        return;
      }

      // Map the comments to the CommentData type
      const mappedComments = comments.map((comment: any) => ({
        id: String(comment.id),
        body: comment.body,
        created_at: comment.created_at,
        author_id: String(comment.author_id),
        ticket_requester_id: ticket.requester ? String(ticket.requester.id) : null,
        ticket_assignee_id: ticket.assignee ? String(ticket.assignee.id) : null
      }));

      // Get the updated score for the current ticket
      const ticketInput: TicketData = {
        id: String(ticket.id),
        comments: mappedComments,
        status: ticket.status,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        requester: ticket.requester ? { id: String(ticket.requester.id) } : null,
        assignee: ticket.assignee ? { id: String(ticket.assignee.id) } : null
      };
        
      const analysisResult = await analyzeComments(zafClient, ticketInput);
      const normalizedScore = Math.max(MIN_SENTIMENT, Math.min(MAX_SENTIMENT, analysisResult.weighted_score)) as SentimentRange;
      console.log('Normalized score:', normalizedScore, 'for ticket', ticket.id);
      console.log('analysisResult:', analysisResult.weighted_score);
      onSentimentUpdate(String(ticket.id), normalizedScore);

      // Get the sentiment for the last 30 days
      const last30DaysScore = await getLast30DaysSentiment(zafClient, ticketInput);
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
