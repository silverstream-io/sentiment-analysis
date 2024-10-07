import React, { useEffect, useState } from 'react';
import { analyzeSentiment } from '../services/apiService';
import SentimentDisplay from './SentimentDisplay';
import { Sentiment } from '../types';

interface AppProps {
  zafClient: any;
}

const App: React.FC<AppProps> = ({ zafClient }) => {
  const [currentSentiment, setCurrentSentiment] = useState<Sentiment>('neutral');
  const [lastThirtySentiment, setLastThirtySentiment] = useState<Sentiment>('neutral');
  const [greyscale, setGreyscale] = useState(false);

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
    <div className="p-2">
      <div className="mb-2">
        <label className="flex items-center text-xs">
          <input
            type="checkbox"
            checked={greyscale}
            onChange={(e) => setGreyscale(e.target.checked)}
            className="mr-1 h-3 w-3"
          />
          <span className="text-gray-600">Greyscale Mode</span>
        </label>
      </div>
      <div className="flex flex-col space-y-2">
        <div>
          <h2 className="text-base font-semibold mb-1">Current Ticket</h2>
          <SentimentDisplay sentiment={currentSentiment} greyscale={greyscale} />
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1">Last 30 Days</h2>
          <SentimentDisplay sentiment={lastThirtySentiment} greyscale={greyscale} />
        </div>
      </div>
    </div>
  );
};

export default App;