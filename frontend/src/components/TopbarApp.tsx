import React, { useEffect, useState } from 'react';
import { getScores, debugLog, errorLog } from '../services/apiService';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

const TopbarApp: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  console.log("[TopbarApp] Component initializing"); // Add this at the very start
  const [ticketScores, setTicketScores] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ticketsPerPage = 10;

  useEffect(() => {
    const fetchUnsolvedTickets = async (page: number) => {
      console.log("[TopbarApp] Starting fetchUnsolvedTickets for page:", page);
      try {
        setIsLoading(true);
        console.log("[TopbarApp] Making zafClient.request");
        const response = await zafClient.request({
          url: `https://api.zendesk.com/api/v2/search.json?query=type:ticket status<solved&page=${page}&per_page=${ticketsPerPage}`,
          type: 'GET',
        });
        console.log("[TopbarApp] zafClient.request response:", response);

        if (!response || !response.results || !Array.isArray(response.results)) {
          console.error("[TopbarApp] Invalid response structure:", response);
          throw new Error('Unexpected response structure');
        }

        const ticketIds = response.results.map((ticket: any) => {
          console.log("[TopbarApp] Processing ticket:", ticket);
          if (!ticket || typeof ticket.id === 'undefined') {
            console.error("[TopbarApp] Invalid ticket structure:", ticket);
            throw new Error('Invalid ticket structure');
          }
          return ticket.id;
        });

        console.log("[TopbarApp] Extracted ticketIds:", ticketIds);
        console.log("[TopbarApp] Calling getScores");
        const scores = await getScores(zafClient, ticketIds);
        console.log("[TopbarApp] Got scores:", scores);
        
        setTicketScores(scores);
        setTotalPages(Math.ceil(response.count / ticketsPerPage));
        setIsLoading(false);
      } catch (error) {
        console.error("[TopbarApp] Detailed error:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          zafClient: !!zafClient,
        });
        errorLog('Error fetching unsolved tickets:', error instanceof Error ? error.message : String(error));
        setError('Failed to fetch ticket scores. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchUnsolvedTickets(currentPage);
  }, [zafClient, currentPage]);

  const getTicketStyleClass = (score: number): string => {
    if (score > 0.75) {
      return 'sentiment-very-positive';
    } else if (score > 0.5) {
      return 'sentiment-positive';
    } else if (score >= -0.5 && score <= 0.5) {
      return 'sentiment-neutral';
    } else if (score >= -0.75 && score < -0.5) {
      return 'sentiment-negative';
    } else {
      return 'sentiment-very-negative';
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (isLoading) {
    return <div>Loading unsolved ticket scores...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="topbar">
      <h2>Unsolved Ticket Sentiment Scores</h2>
      {Object.entries(ticketScores).length > 0 ? (
        <>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {Object.entries(ticketScores).map(([ticketId, score]) => (
              <li key={ticketId} style={{ marginBottom: '5px' }}>
                <a
                  href={`/agent/tickets/${ticketId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`sentiment-score ${getTicketStyleClass(score)}`}
                >
                  Ticket {ticketId}: {score.toFixed(2)}
                </a>
              </li>
            ))}
          </ul>
          <div className="pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                disabled={page === currentPage}
              >
                {page}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p>No unsolved tickets found.</p>
      )}
    </div>
  );
};

export default TopbarApp;
