import React, { useEffect } from 'react';
import { updateTicketSentiment, debugLog, errorLog } from '../services/apiService';
import { TicketData, ZendeskTicketStatus } from '../types';
import { eventBus } from '../services/eventBus';

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
        // Get ticket details using search API
        const response = await zafClient.request({
          url: `/api/v2/search.json?query=id:${data.id}`,
          type: 'GET'
        });

        if (response && response.results && response.results.length > 0) {
          const ticket = response.results[0];
          const ticketData: TicketData = {
            id: ticket.id.toString(),
            state: ticket.status as ZendeskTicketStatus,
            created_at: ticket.created_at,
            updated_at: ticket.updated_at
          };
          console.log('[BackgroundApp] Sending ticket data:', ticketData);
          await updateTicketSentiment(zafClient, ticketData);
          // Trigger event for topbar
          eventBus.trigger('sentiment.updated', { ticketId: data.id });
        } else {
          console.error('[BackgroundApp] Could not find ticket details');
        }
      } catch (error) {
        console.error('[BackgroundApp] Error:', error);
      }
    };

    console.log('[BackgroundApp] Adding ticket.saved event listener');
    zafClient.on('ticket.saved', handleTicketSaved);

    return () => {
      console.log('[BackgroundApp] Removing ticket.saved event listener');
      zafClient.off('ticket.saved', handleTicketSaved);
    };
  }, [zafClient]);

  return null;
};

export default BackgroundApp;
