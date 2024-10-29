import React, { useEffect, useState } from 'react';
import { getUnsolvedTicketsFromCache, debugLog } from '../services/apiService';
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
  const [isInitializing, setIsInitializing] = useState(false);
  const POLL_INTERVAL = 60000; // Poll every 60 seconds

  useEffect(() => {
    // Listen for initialization messages
    const messageHandler = (data: any) => {
      if (data.type === 'INIT_START') {
        setIsInitializing(true);
        setIsLoading(true);
      } else if (data.type === 'INIT_COMPLETE') {
        setIsInitializing(false);
        fetchCounts();
      }
    };

    zafClient.on('message', messageHandler);
    fetchCounts();
    const pollInterval = setInterval(fetchCounts, POLL_INTERVAL);

    return () => {
      zafClient.off('message', messageHandler);
      clearInterval(pollInterval);
    };
  }, [zafClient]);

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
      debugLog('Error fetching counts:', error);
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="topbar-counts initializing">
        <div className="message">Evaluating backlog, please stand by...</div>
      </div>
    );
  }

  return (
    <div className="topbar-counts">
      <div className="count-box negative">{isLoading ? '...' : counts.negative}</div>
      <div className="count-box neutral">{isLoading ? '...' : counts.neutral}</div>
      <div className="count-box positive">{isLoading ? '...' : counts.positive}</div>
    </div>
  );
};

export default TopbarApp;
