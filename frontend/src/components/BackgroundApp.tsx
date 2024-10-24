import React, { useEffect } from 'react';
import { listTicketVectors, analyzeComments, getScore, debugLog, errorLog } from '../services/apiService';

interface BackgroundAppProps {
  zafClient: any;
  originalQueryString: string;
}

const BackgroundApp: React.FC<BackgroundAppProps> = ({ zafClient, originalQueryString }) => {
  useEffect(() => {
    console.log('BackgroundApp useEffect triggered');
    const handleTicketSaved = async (data: { ticket: { id: string } }) => {
      const ticketId = data.ticket.id;
      console.log(`Ticket ${ticketId} saved, triggering background refresh`);
      errorLog(`Ticket ${ticketId} saved, triggering background refresh`);

      try {
        const storedVectors = await listTicketVectors(zafClient, ticketId);
        const ticketComments = await zafClient.get('ticket.comments');

        if (Object.keys(storedVectors).length === 0) {
          debugLog('No vectors found for ticket:', ticketId);
          await analyzeComments(zafClient, ticketId, ticketComments);
        } else {
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
      } catch (error) {
        console.error('Error in background refresh:', error);
      }
    };

    console.log('Adding ticket.saved event listener');
    zafClient.on('ticket.saved', handleTicketSaved);

    return () => {
      console.log('Removing ticket.saved event listener');
      zafClient.off('ticket.saved', handleTicketSaved);
    };
  }, [zafClient]);

  console.log('BackgroundApp rendered');
  return null; // This component doesn't render anything
};

export default BackgroundApp;
