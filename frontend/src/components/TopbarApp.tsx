import React, { useEffect, useState } from 'react';
import { getUnsolvedTicketsFromCache, debugLog, errorLog } from '../services/apiService';
import { getSubdomain } from '../utils';
import { TicketData, SentimentRange } from '../types';
import { eventBus } from '../services/eventBus';

type SortField = 'sentiment' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

// Add ErrorBoundary class
class TopbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[TopbarApp] Error caught by boundary:', error);
    console.error('[TopbarApp] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          An error occurred in the topbar.
          <br />
          {this.state.error?.message}
        </div>
      );
    }

    return this.props.children;
  }
}

const TopbarContent: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  console.log("[TopbarApp] Component initializing");
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortField, setSortField] = useState<SortField>('sentiment');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [subdomain, setSubdomain] = useState<string>('');

  // Get subdomain when component mounts
  useEffect(() => {
    const initSubdomain = async () => {
      try {
        const domain = await getSubdomain(zafClient);
        setSubdomain(domain);
      } catch (error) {
        console.error('[TopbarApp] Error getting subdomain:', error);
      }
    };
    initSubdomain();
  }, [zafClient]);

  const fetchUnsolvedTickets = async (page: number) => {
    console.log("[TopbarApp] Starting fetchUnsolvedTickets");
    try {
      setIsLoading(true);
      
      const ticketResponse = await getUnsolvedTicketsFromCache(zafClient, page);
      console.log("[TopbarApp] Got unsolved tickets:", ticketResponse);

      setTotalPages(Math.ceil(ticketResponse.count / 10));

      // Sort tickets based on selected field and direction
      const sortedTickets = [...ticketResponse.results].sort((a, b) => {
        if (sortField === 'sentiment') {
          const scoreA = a.score ?? 0;
          const scoreB = b.score ?? 0;
          return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        } else {
          const dateA = new Date(a[sortField]).getTime();
          const dateB = new Date(b[sortField]).getTime();
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        }
      });

      setTickets(sortedTickets);
      setIsLoading(false);
    } catch (error: any) {
      console.error("[TopbarApp] Error:", error);
      setError(`Failed to fetch tickets: ${error.message}`);
      setIsLoading(false);
    }
  };

  // Initial load effect
  useEffect(() => {
    fetchUnsolvedTickets(currentPage);
  }, [zafClient, currentPage, sortField, sortDirection]);

  // Event bus effect
  useEffect(() => {
    // Initialize event bus
    eventBus.initialize(zafClient);
    
    // Subscribe to sentiment updates
    const handleSentimentUpdate = async () => {
      // Refresh the current page of tickets
      await fetchUnsolvedTickets(currentPage);
    };
    
    eventBus.subscribe('sentiment.updated', handleSentimentUpdate);
    
    return () => {
      eventBus.unsubscribe('sentiment.updated', handleSentimentUpdate);
    };
  }, [zafClient, currentPage]);

  const getSentimentColor = (score: number): string => {
    if (score > 0.75) return 'bg-green-500';
    if (score > 0.5) return 'bg-green-300';
    if (score >= -0.5 && score <= 0.5) return 'bg-yellow-400';
    if (score >= -0.75) return 'bg-red-300';
    return 'bg-red-500';
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const truncateSubject = (subject: string | undefined): string => {
    if (!subject) return 'No subject';
    return subject.length > 24 ? `${subject.slice(0, 21)}...` : subject;
  };

  if (isLoading) {
    return <div className="loading-state">Loading unsolved tickets...</div>;
  }

  if (error) {
    return <div className="error-state">{error}</div>;
  }

  return (
    <div className="topbar">
      <div className="flex justify-between items-center mb-4">
        <h2 className="topbar-title">Unsolved Tickets</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSort('sentiment')}
            className={`sort-button ${sortField === 'sentiment' ? 'active' : ''}`}
          >
            Sentiment {sortField === 'sentiment' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('created_at')}
            className={`sort-button ${sortField === 'created_at' ? 'active' : ''}`}
          >
            Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
          <button 
            onClick={() => handleSort('updated_at')}
            className={`sort-button ${sortField === 'updated_at' ? 'active' : ''}`}
          >
            Updated {sortField === 'updated_at' && (sortDirection === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {tickets.length > 0 ? (
        <div className="ticket-list">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="ticket-item flex items-center gap-2">
              <div 
                className={`w-2 h-2 ${getSentimentColor(ticket.score ?? 0)}`} 
                title={`Sentiment score: ${ticket.score?.toFixed(2)}`}
              />
              <a
                href={`https://${subdomain}.zendesk.com/agent/tickets/${ticket.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-link flex-grow"
              >
                <span className="ticket-id mr-2">#{ticket.id}</span>
                <span className="ticket-subject" title={ticket.subject}>
                  {truncateSubject(ticket.subject)}
                </span>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <p className="loading-state">No unsolved tickets found.</p>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`pagination-button ${page === currentPage ? 'active' : ''}`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const TopbarApp: React.FC<TopbarAppProps> = (props) => {
  return (
    <TopbarErrorBoundary>
      <TopbarContent {...props} />
    </TopbarErrorBoundary>
  );
};

export default TopbarApp;
