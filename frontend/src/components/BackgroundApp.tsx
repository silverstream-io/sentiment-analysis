import React, { useEffect } from 'react';
import { updateTicketSentiment, debugLog, errorLog } from '../services/apiService';

interface BackgroundAppProps {
  zafClient: any;
  originalQueryString: string;
}

const BackgroundApp: React.FC<BackgroundAppProps> = ({ zafClient, originalQueryString }) => {
  useEffect(() => {
    console.log('[BackgroundApp] useEffect triggered');
    const handleTicketSaved = async (data: any) => {
      console.log('[BackgroundApp] Ticket saved event received:', data);
      
      try {
        // Get the ticket details using the search API instead of direct access
        const response = await zafClient.request({
          url: `/api/v2/search.json?query=id:${data.id}`,
          type: 'GET'
        });
        
        if (response && response.results && response.results.length > 0) {
          const ticketId = response.results[0].id;
          console.log(`[BackgroundApp] Processing ticket ${ticketId}`);
          await updateTicketSentiment(zafClient, ticketId);
        } else {
          console.error('[BackgroundApp] Could not find ticket details');
        }
      } catch (error) {
        console.error('[BackgroundApp] Error in background refresh:', error);
      }
    };

    console.log('[BackgroundApp] Adding ticket.saved event listener');
    zafClient.on('ticket.saved', handleTicketSaved);

    return () => {
      console.log('[BackgroundApp] Removing ticket.saved event listener');
      zafClient.off('ticket.saved', handleTicketSaved);
    };
  }, [zafClient]);

  console.log('[BackgroundApp] Component rendered');
  return null;
};

export default BackgroundApp;
