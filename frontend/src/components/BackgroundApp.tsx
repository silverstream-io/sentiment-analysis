import React, { useEffect, useState } from 'react';
import { 
  debugLog, 
  errorLog, 
  checkNamespace, 
  analyzeComments,
  getUnsolvedTickets,
  removeTicketFromCache,
  getTicketCountData,
  getTicketVectorCountData,
  notifyApp,
} from '../services/apiService';
import { TicketData } from '../types';

interface BackgroundAppProps {
  zafClient: any;
  originalQueryString: string;
}

const BackgroundApp: React.FC<BackgroundAppProps> = ({ zafClient, originalQueryString }) => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    debugLog('[BackgroundApp] Running useEffect...');
    
    // Initial setup
    initializeApp();
    setupEventListeners();

    // Set up periodic refresh (45 minutes)
    const refreshInterval = setInterval(refreshCache, 45 * 60 * 1000);
    
    // Cleanup
    return () => {
      debugLog('[BackgroundApp] Cleaning up...');
      clearInterval(refreshInterval);
    };
  }, [zafClient, originalQueryString]);

  const initializeApp = async () => {
    debugLog('[BackgroundApp] Starting initialization...');
    try {
      // Check if namespace exists
      const subdomain = await getSubdomain();
      const namespaceExists = await checkNamespace(zafClient, subdomain);
      debugLog(`[BackgroundApp] initializeApp Namespace ${subdomain} exists:`, namespaceExists);

      if (!namespaceExists) {
        // Notify other components we're starting initialization
        zafClient.trigger('pauseTicketDisplay', {'status': 'pause'});
        debugLog('[BackgroundApp] initializeApp Paused ticket display');

        // Get all unsolved tickets
        const tickets = await getAllUnsolvedTickets();
        debugLog(`[BackgroundApp] initializeApp Found ${tickets.length} unsolved tickets to process`);

        // Process each ticket
        for (const ticket of tickets) {
          await processTicket(ticket);
        }

        // Notify other components we're done
        zafClient.trigger('pauseTicketDisplay', {'status': 'resume'});
        debugLog('[BackgroundApp] initializeApp Resumed ticket display');
      } else {
        const ticketVectorCountData = await getTicketVectorCountData(zafClient);
        const vectorCount = ticketVectorCountData?.count || 0;
        debugLog(`[BackgroundApp] initializeApp Found ${vectorCount} tickets in vector database`);

        const ticketCountData = await getTicketCountData(zafClient);
        const ticketCount = ticketCountData?.count?.value || 0;
        debugLog(`[BackgroundApp] initializeApp Found ${ticketCount} tickets in Zendesk`);
        if (vectorCount < ticketCount) {
          try {
            const latestTicketResponse = await zafClient.request({
              url: `/api/v2/tickets/recent?sort_by=created_at&sort_order=desc&page=1&per_page=1`,
              type: 'GET'
            });

            debugLog('[BackgroundApp] initializeApp Latest ticket response:', latestTicketResponse);

            if (!latestTicketResponse || !latestTicketResponse.ticket) {
              errorLog('[BackgroundApp] initializeApp Invalid response format for latest ticket:', latestTicketResponse);
              return;
            }

            const latestTicketId = latestTicketResponse.ticket.id;
            debugLog(`[BackgroundApp] initializeApp Latest ticket ID: ${latestTicketId}`);

            if (latestTicketId > (ticketCountData?.latest_ticket || 0)) {
              debugLog(`[BackgroundApp] initializeApp Mismatch between vector database and Zendesk. Refreshing vector database...`);
              const tickets = await getAllUnsolvedTickets(latestTicketResponse.ticket.created_at);
              for (const ticket of tickets) {
                await processTicket(ticket);
              }
            }
          } catch (error) {
            errorLog('[BackgroundApp] initializeApp Error fetching latest ticket:', error);
          }
        }
      }

      setIsInitializing(false);
      debugLog('[BackgroundApp] Initialization complete');
    } catch (error) {
      errorLog('[BackgroundApp] Error during initialization:', error);
      setIsInitializing(false);
    }
  };

  const setupEventListeners = () => {
    debugLog('[BackgroundApp] Setting up event listeners...');
    
    zafClient.on('ticket.saved', async (context: any) => {
      debugLog('[BackgroundApp] Received ticket.saved event:', context);
      try {
        const id = context.id;
        const ticket = await getTicketDetails(id);

        // If ticket is solved or closed, remove from cache
        if (ticket.status === 'solved' || ticket.status === 'closed') {
          await removeTicketFromCache(zafClient, ticket);
          debugLog(`[BackgroundApp] setupEventListeners Removed solved/closed ticket ${id} from cache`);
          return;
        }

        // For unsolved tickets, check the latest comment
        const commentsResponse = await zafClient.request({
          url: `/api/v2/tickets/${id}/comments?sort=created_at&per_page=1&page=1&sort_order=desc`,
          type: 'GET'
        });
        debugLog('[BackgroundApp] setupEventListeners Comments response:', commentsResponse);

        const latestComment = commentsResponse.comments[commentsResponse.comments.length - 1];
        debugLog('[BackgroundApp] setupEventListeners Latest comment:', latestComment);
        // Only analyze if the latest comment is from an end-user
        if (latestComment && latestComment.author.role === 'end-user') {
          await processTicket(ticket);
          debugLog(`[BackgroundApp] setupEventListeners Processed new end-user comment for ticket ${id}`);
        }
      } catch (error) {
        errorLog('[BackgroundApp] setupEventListeners Error handling ticket.saved event:', error);
      }
    });
    
    debugLog('[BackgroundApp] Event listeners setup complete');
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

    while (hasMore && currentTimestamp) {
      const response = await getUnsolvedTickets(zafClient, page, 100, currentTimestamp);
      allTickets = [...allTickets, ...response.results];
      hasMore = response.next_page !== null;
      page++;
      currentTimestamp = response.results[response.results.length - 1].created_at || undefined;
      debugLog(`[BackgroundApp] getAllUnsolvedTickets Loaded ${allTickets.length} tickets...`);
    }

    return allTickets;
  };

  const getTicketDetails = async (id: number): Promise<TicketData> => {
    const response = await zafClient.request({
      url: `/api/v2/tickets/${id}.json`,
      type: 'GET'
    });
    return response.ticket;
  };

  const processTicket = async (ticket: TicketData) => {
    try {
      // Get ticket comments
      const commentsResponse = await zafClient.request({
        url: `/api/v2/tickets/${ticket.id}/comments?sort=created_at`,
        type: 'GET'
      });
      debugLog('[BackgroundApp] processTicket Comments response:', commentsResponse);

      if (!commentsResponse || !commentsResponse.comments) {
        errorLog(`[BackgroundApp] processTicket No comments found for ticket ${ticket.id}`);
        return;
      }

      debugLog(`[BackgroundApp] processTicket Processing ${commentsResponse.comments.length} comments for ticket ${ticket.id}`);

      const ticketInput: TicketData = {
        id: ticket.id,
        status: ticket.status,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        comments: commentsResponse.comments.map((comment: any) => ({
          id: comment.id,
          body: comment.body,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          author_id: comment.author.id,
          ticket_requester_id: ticket.requester?.id,
          ticket_assignee_id: ticket.assignee?.id
        }))
      };

      await analyzeComments(zafClient, ticketInput);
      debugLog(`[BackgroundApp] processTicket Processed ticket ${ticket.id}`);
    } catch (error) {
      errorLog(`[BackgroundApp] processTicket Error processing ticket ${ticket.id}:`, error);
    }
  };

  const refreshCache = async () => {
    debugLog('[BackgroundApp] Starting cache refresh...');
    try {
      const tickets = await getAllUnsolvedTickets();
      debugLog(`[BackgroundApp] Found ${tickets.length} unsolved tickets to refresh`);
      if (tickets.length > 0) {
        zafClient.trigger('pauseTicketDisplay', {'status': 'pause'});
      
        for (const ticket of tickets) {
          await processTicket(ticket);
        }

        zafClient.trigger('pauseTicketDisplay', {'status': 'resume'});
      }
      
      // Notify components to update their displays
      debugLog('[BackgroundApp] Cache refresh complete');
    } catch (error) {
      errorLog('[BackgroundApp] Error refreshing cache:', error);
    }
  };

  return null;  // Background app has no UI
};

export default BackgroundApp;
