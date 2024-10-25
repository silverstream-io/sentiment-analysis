import React, { useEffect, useState } from 'react';
import { getScores, debugLog, errorLog } from '../services/apiService';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

const TopbarApp: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  const [ticketScores, setTicketScores] = useState<{ [key: string]: number }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUnsolvedTickets = async () => {
      try {
        setIsLoading(true);
        const response = await zafClient.request({
          url: '/api/v2/search.json?query=type:ticket status<solved',
          type: 'GET',
        });
        const ticketIds = response.results.map((ticket: any) => ticket.id);
        const scores = await getScores(zafClient, ticketIds);
        setTicketScores(scores);
        setIsLoading(false);
      } catch (error) {
        errorLog('Error fetching unsolved tickets:', error);
        setError('Failed to fetch ticket scores. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchUnsolvedTickets();
  }, [zafClient]);

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
      ) : (
        <p>No unsolved tickets found.</p>
      )}
    </div>
  );
};

export default TopbarApp;
