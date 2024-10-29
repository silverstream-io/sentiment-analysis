import React, { useEffect, useState } from 'react';
import { 
  debugLog, 
  errorLog, 
  checkNamespace, 
  analyzeComments,
  getUnsolvedTickets,
  updateTicketSentiment,
  getTicketCountData,
  getTicketVectorCountData,
  notifyApp
} from '../services/apiService';
import { TicketData } from '../types';

interface BackgroundAppProps {
  zafClient: any;
  originalQueryString: string;
}

const BackgroundApp: React.FC<BackgroundAppProps> = ({ zafClient, originalQueryString }) => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeApp();
    setupEventListeners();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if namespace exists
      const subdomain = await getSubdomain();
      const namespaceExists = await checkNamespace(zafClient, subdomain);
      console.log(`Namespace ${subdomain} exists:`, namespaceExists);

      if (!namespaceExists) {
        // Notify other components we're starting initialization
        zafClient.trigger('api_notification.pauseTicketDisplay', {'status': 'pause'});

        // Get all unsolved tickets
        const tickets = await getAllUnsolvedTickets();
        debugLog(`Found ${tickets.length} unsolved tickets to process`);

        // Process each ticket
        for (const ticket of tickets) {
          await processTicket(ticket);
        }

        // Notify other components we're done
        zafClient.trigger('api_notification.pauseTicketDisplay', {'status': 'resume'});
      } else {
        const ticketVectorCountData = await getTicketVectorCountData(zafClient);
        const vectorCount = ticketVectorCountData?.count || 0;
        debugLog(`Found ${vectorCount} tickets in vector database`);

        const ticketCountData = await getTicketCountData(zafClient);
        const ticketCount = ticketCountData?.count?.value || 0;
        debugLog(`Found ${ticketCount} tickets in Zendesk`);
        if (vectorCount < ticketCount) {
          try {
            const latestTicketResponse = await zafClient.request({
              url: `/api/v2/tickets/recent?sort_by=created_at&sort_order=desc&page=1&per_page=1`,
              type: 'GET'
            });

            debugLog('Latest ticket response:', latestTicketResponse);

            if (!latestTicketResponse || !latestTicketResponse.ticket) {
              errorLog('Invalid response format for latest ticket:', latestTicketResponse);
              return;
            }

            const latestTicketId = latestTicketResponse.ticket.id;
            debugLog(`Latest ticket ID: ${latestTicketId}`);

            if (latestTicketId > (ticketCountData?.latest_ticket || 0)) {
              debugLog(`Mismatch between vector database and Zendesk. Refreshing vector database...`);
              const tickets = await getAllUnsolvedTickets(latestTicketResponse.ticket.created_at);
              for (const ticket of tickets) {
                await processTicket(ticket);
              }
            }
          } catch (error) {
            errorLog('Error fetching latest ticket:', error);
          }
        }
      }

      setIsInitializing(false);
    } catch (error) {
      errorLog('Error during initialization:', error);
      setIsInitializing(false);
    }
  };

  const setupEventListeners = () => {
    zafClient.on('ticket.saved', async (context: any) => {
      try {
        const ticketId = context.ticketId;
        const ticket = await getTicketDetails(ticketId);

        // If ticket is solved or closed, remove from cache
        if (ticket.state === 'solved' || ticket.state === 'closed') {
          await updateTicketSentiment(zafClient, {
            ...ticket,
            state: ticket.state
          });
          debugLog(`Removed solved/closed ticket ${ticketId} from cache`);
          return;
        }

        // For unsolved tickets, check the latest comment
        const commentsResponse = await zafClient.request({
          url: `/api/v2/tickets/${ticketId}/comments.json`,
          type: 'GET'
        });

        const latestComment = commentsResponse.comments[commentsResponse.comments.length - 1];
        
        // Only analyze if the latest comment is from an end-user
        if (latestComment && latestComment.author.role === 'end-user') {
          await processTicket(ticket);
          debugLog(`Processed new end-user comment for ticket ${ticketId}`);
        }
      } catch (error) {
        errorLog('Error handling ticket.saved event:', error);
      }
    });
  };

  const getSubdomain = async (): Promise<string> => {
    const context = await zafClient.context();
    return context.account.subdomain;
  };

  const getAllUnsolvedTickets = async (startTimestamp?: string ): Promise<TicketData[]> => {
    let allTickets: TicketData[] = [];
    let page = 1;
    let hasMore = true;
    let currentTimestamp = startTimestamp;

    while (hasMore) {
      const response = await getUnsolvedTickets(zafClient, page, 100, currentTimestamp);
      allTickets = [...allTickets, ...response.results];
      hasMore = response.next_page !== null;
      page++;
      currentTimestamp = response.results[response.results.length - 1].created_at;
      debugLog(`Loaded ${allTickets.length} tickets...`);
    }

    return allTickets;
  };

  const getTicketDetails = async (ticketId: number): Promise<TicketData> => {
    const response = await zafClient.request({
      url: `/api/v2/tickets/${ticketId}.json`,
      type: 'GET'
    });
    return response.ticket;
  };

  const processTicket = async (ticket: TicketData) => {
    try {
      // Get ticket comments
      const commentsResponse = await zafClient.request({
        url: `/api/v2/tickets/${ticket.id}/comments.json`,
        type: 'GET'
      });

      if (!commentsResponse || !commentsResponse.comments) {
        errorLog(`No comments found for ticket ${ticket.id}`);
        return;
      }

      debugLog(`Processing ${commentsResponse.comments.length} comments for ticket ${ticket.id}`);

      // Process comments
      await analyzeComments(zafClient, ticket.id, {
        'ticket.comments': commentsResponse.comments.map((comment: any) => ({
          id: comment.id,
          value: comment.body,
          created_at: comment.created_at,
          author: comment.author
        }))
      });

      debugLog(`Processed ticket ${ticket.id}`);
    } catch (error) {
      errorLog(`Error processing ticket ${ticket.id}:`, error);
    }
  };

  return null;  // Background app has no UI
};

export default BackgroundApp;
