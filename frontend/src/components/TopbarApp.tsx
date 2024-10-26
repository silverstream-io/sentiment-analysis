import React, { useEffect, useState } from 'react';
import { getScores, debugLog, errorLog } from '../services/apiService';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

class TopbarErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[TopbarApp] Error caught by boundary:', error);
    console.error('[TopbarApp] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          An error occurred while loading the topbar.
          <br />
          {this.state.error?.message || 'Unknown error'}
        </div>
      );
    }

    return this.props.children;
  }
}

const TopbarContent: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  console.log("[TopbarApp] Component initializing");
  const [ticketScores, setTicketScores] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [subdomain, setSubdomain] = useState<string>('');
  const ticketsPerPage = 10;

  useEffect(() => {
    // Get the subdomain when component mounts
    const getSubdomain = async () => {
      try {
        const context = await zafClient.context();
        setSubdomain(context.account.subdomain);
      } catch (error) {
        console.error("[TopbarApp] Error getting subdomain:", error);
      }
    };
    getSubdomain();

    const fetchUnsolvedTickets = async (page: number) => {
      console.log("[TopbarApp] Starting fetchUnsolvedTickets for page:", page);
      try {
        setIsLoading(true);
        // Add sort parameter to the query
        const sortQuery = `type:ticket status<solved&sort_by:updated_at&sort_order:${sortOrder}`;
        console.log("[TopbarApp] Using search query:", sortQuery);
        
        const response = await zafClient.request({
          url: `/api/v2/search/incremental?query=${sortQuery}&page=${page}&per_page=${ticketsPerPage}`,
          type: 'GET'
        });
        console.log("[TopbarApp] Search API response:", response);

        if (!response || !response.results || !Array.isArray(response.results)) {
          console.error("[TopbarApp] Invalid response structure:", response);
          throw new Error('Unexpected response structure');
        }

        const ticketIds = response.results.map((ticket: any) => ticket.id);
        console.log("[TopbarApp] Extracted ticketIds:", ticketIds);
        
        if (ticketIds.length > 0) {
          const scores = await getScores(zafClient, ticketIds);
          console.log("[TopbarApp] Got scores:", scores);
          if (Object.keys(scores).length === 0) {
            console.error("[TopbarApp] No scores returned for tickets:", ticketIds);
          }
          setTicketScores(scores);
          setTotalPages(Math.ceil(response.count / ticketsPerPage));
        } else {
          console.log("[TopbarApp] No ticket IDs found in response");
        }
        setIsLoading(false);
      } catch (error: any) {
        console.error("[TopbarApp] Error:", error);
        setError(`Failed to fetch ticket scores: ${error.message}`);
        setIsLoading(false);
      }
    };

    fetchUnsolvedTickets(currentPage);
  }, [zafClient, currentPage, sortOrder]);

  const getTicketStyleClass = (score: number): string => {
    if (score > 0.75) return 'sentiment-very-positive';
    if (score > 0.5) return 'sentiment-positive';
    if (score >= -0.5 && score <= 0.5) return 'sentiment-neutral';
    if (score >= -0.75) return 'sentiment-negative';
    return 'sentiment-very-negative';
  };

  const toggleSortOrder = () => {
    setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
  };

  if (isLoading) {
    return <div className="loading-state">Loading unsolved ticket scores...</div>;
  }

  if (error) {
    return <div className="error-state">{error}</div>;
  }

  return (
    <div className="topbar">
      <div className="sort-control">
        <h2 className="topbar-title">Unsolved Ticket Sentiment Scores</h2>
        <button 
          onClick={toggleSortOrder}
          className="sort-button"
          title={`Sorted by last update ${sortOrder === 'asc' ? 'oldest first' : 'newest first'}`}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>
      {Object.entries(ticketScores).length > 0 ? (
        <div className="ticket-list">
          {Object.entries(ticketScores).map(([ticketId, score]) => (
            <div key={ticketId} className={`ticket-item ${getTicketStyleClass(score)}`}>
              <a
                href={`https://${subdomain}.zendesk.com/agent/tickets/${ticketId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ticket-link"
              >
                <span className="ticket-id">Ticket {ticketId}</span>
                <span className="ticket-score">{score.toFixed(2)}</span>
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
