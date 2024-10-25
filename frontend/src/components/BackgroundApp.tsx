import React, { useEffect } from 'react';
import { updateTicketSentiment, debugLog, errorLog } from '../services/apiService';

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
        await updateTicketSentiment(zafClient, ticketId);
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

  return null;
};

export default BackgroundApp;
