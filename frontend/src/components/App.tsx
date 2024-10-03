import React, { useEffect, useState } from 'react';
import { analyzeSentiment } from '../services/apiService';
import SentimentWheel from './SentimentWheel';
import { Sentiment } from '../types';

interface AppProps {
  zafClient: any;
}

const App: React.FC<AppProps> = ({ zafClient }) => {
  const [currentSentiment, setCurrentSentiment] = useState<Sentiment>('neutral');
  const [lastThirtySentiment, setLastThirtySentiment] = useState<Sentiment>('neutral');

  useEffect(() => {
    const fetchSentiments = async () => {
      try {
        // Fetch current ticket sentiment
        const currentTicketComments = await zafClient.get('ticket.comments');
        console.log('Current ticket comments:', currentTicketComments);
        const currentSentimentResult = await analyzeSentiment(currentTicketComments);
        console.log('Current sentiment result:', currentSentimentResult);
        setCurrentSentiment(currentSentimentResult);

        // Fetch last 30 days sentiment (this is a placeholder, you'll need to implement the actual logic)
        const lastThirtySentimentResult = await analyzeSentiment([]);
        console.log('Last 30 days sentiment result:', lastThirtySentimentResult);
        setLastThirtySentiment(lastThirtySentimentResult);
      } catch (error) {
        console.error('Error fetching sentiments:', error);
      }
    };

    fetchSentiments();
  }, [zafClient]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center">
        <div className="w-1/2 pr-2">
          <h2 className="text-lg font-semibold mb-2">Current Ticket</h2>
          <SentimentWheel sentiment={currentSentiment} />
        </div>
        <div className="w-1/2 pl-2">
          <h2 className="text-lg font-semibold mb-2">Last 30 Days</h2>
          <SentimentWheel sentiment={lastThirtySentiment} />
        </div>
      </div>
    </div>
  );
};

export default App;