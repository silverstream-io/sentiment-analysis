import React, { useEffect, useState } from 'react';
import { getScores, debugLog, errorLog } from '../services/apiService';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

const TopbarApp: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  const [ticketScores, setTicketScores] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const fetchUnsolvedTickets = async () => {
      try {
        const response = await zafClient.request({
          url: '/api/v2/search.json?query=type:ticket status<solved',
          type: 'GET',
        });
        const ticketIds = response.results.map((ticket: any) => ticket.id);
        const scores = await getScores(zafClient, ticketIds);
        setTicketScores(scores);
      } catch (error) {
        errorLog('Error fetching unsolved tickets:', error);
      }
    };

    fetchUnsolvedTickets();
  }, [zafClient]);

  return (
    <div className="topbar">
      <h2>Unsolved Ticket Sentiment Scores</h2>
      <ul>
        {Object.entries(ticketScores).map(([ticketId, score]) => (
          <li key={ticketId}>
            <a href={`/agent/tickets/${ticketId}`}>Ticket {ticketId}: {score}</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TopbarApp;
