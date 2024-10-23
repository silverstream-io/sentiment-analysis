import React, { useEffect } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog, errorLog } from '../services/apiService';

interface BackgroundAppProps {
  zafClient: any;
}

const BackgroundApp: React.FC<BackgroundAppProps> = ({ zafClient }) => {
  useEffect(() => {
    const handleTicketSaved = async (data: { ticket: { id: string } }) => {
      const ticketId = data.ticket.id;
      errorLog(`Ticket ${ticketId} saved, triggering background refresh`);

      try {
        const storedVectors = await listTicketVectors(zafClient, ticketId);
        const ticketComments = await zafClient.get('ticket.comments');

        if (Object.keys(storedVectors).length === 0) {
          debugLog('No vectors found for ticket:', ticketId);
          await analyzeComments(zafClient, ticketId, ticketComments);
        } else {
          const newComments = ticketComments['ticket.comments'].filter((comment: any) => 
            !Object.values(storedVectors).some((vector: any) => vector.id === `${ticketId}#${comment.id}`)
          );
          if (newComments.length > 0) {
            debugLog('Analyzing new comments:', newComments);
            await analyzeComments(zafClient, ticketId, { 'ticket.comments': newComments });
          }
        }
      } catch (error) {
        console.error('Error in background refresh:', error);
      }
    };

    zafClient.on('ticket.saved', handleTicketSaved);

    return () => {
      zafClient.off('ticket.saved', handleTicketSaved);
    };
  }, [zafClient]);

  return null; // This component doesn't render anything
};

export default BackgroundApp;

