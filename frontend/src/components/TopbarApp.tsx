import React, { useEffect, useState } from 'react';
import { getUnsolvedTicketsFromCache } from '../services/apiService';
import { TicketData } from '../types';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

const TopbarApp: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  const [counts, setCounts] = useState({
    negative: 0,
    neutral: 0,
    positive: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const POLL_INTERVAL = 60000; // Poll every 60 seconds

  const fetchCounts = async () => {
    try {
      const response = await getUnsolvedTicketsFromCache(zafClient);
      const tickets = response?.results || [];

      const newCounts = tickets.reduce((acc, ticket: TicketData) => {
        const score = ticket?.score ?? 0;
        if (score <= -0.5) acc.negative++;
        else if (score >= 0.5) acc.positive++;
        else acc.neutral++;
        return acc;
      }, { negative: 0, neutral: 0, positive: 0 });

      setCounts(newCounts);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching counts:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const pollInterval = setInterval(fetchCounts, POLL_INTERVAL);
    return () => clearInterval(pollInterval);
  }, [zafClient]);

  return (
    <div className="topbar-counts">
      <div className="count-box negative">{counts.negative}</div>
      <div className="count-box neutral">{counts.neutral}</div>
      <div className="count-box positive">{counts.positive}</div>
    </div>
  );
};

export default TopbarApp;
