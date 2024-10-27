import React, { useEffect, useState } from 'react';
import { getUnsolvedTicketsFromCache, debugLog, errorLog } from '../services/apiService';
import { TicketData } from '../types';

interface TopbarAppProps {
  zafClient: any;
  originalQueryString: string;
}

interface SentimentCounts {
  negative: number;
  neutral: number;
  positive: number;
}

const TopbarContent: React.FC<TopbarAppProps> = ({ zafClient, originalQueryString }) => {
  const [counts, setCounts] = useState<SentimentCounts>({
    negative: 0,
    neutral: 0,
    positive: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await getUnsolvedTicketsFromCache(zafClient);
        const tickets = response.results;

        const newCounts = tickets.reduce((acc: SentimentCounts, ticket: TicketData) => {
          const score = ticket.score ?? 0;
          if (score <= -0.5) acc.negative++;
          else if (score >= 0.5) acc.positive++;
          else acc.neutral++;
          return acc;
        }, { negative: 0, neutral: 0, positive: 0 });

        setCounts(newCounts);
        setIsLoading(false);
      } catch (error) {
        errorLog('Error fetching counts:', error);
        setIsLoading(false);
      }
    };

    fetchCounts();
  }, [zafClient]);

  const openNavBar = (range: 'negative' | 'neutral' | 'positive') => {
    zafClient.invoke('nav_bar', 'show', {
      url: `assets/iframe.html?type=navbar&range=${range}`,
      active: true
    });
  };

  return (
    <div className="topbar-counts">
      <div 
        className="count-box negative"
        onClick={() => openNavBar('negative')}
      >
        {counts.negative}
      </div>
      <div 
        className="count-box neutral"
        onClick={() => openNavBar('neutral')}
      >
        {counts.neutral}
      </div>
      <div 
        className="count-box positive"
        onClick={() => openNavBar('positive')}
      >
        {counts.positive}
      </div>
    </div>
  );
};

const TopbarApp: React.FC<TopbarAppProps> = (props) => {
  return (
    <TopbarContent {...props} />
  );
};

export default TopbarApp;
