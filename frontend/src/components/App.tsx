import React, { useState } from 'react';
import SentimentAnalysis from './SentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';

interface AppProps {
  zafClient: any;
}

const App: React.FC<AppProps> = ({ zafClient }) => {
  const [currentSentiment, setCurrentSentiment] = useState<number | null>(null);
  const [lastThirtySentiment, setLastThirtySentiment] = useState<number | null>(null);
  const [greyscale] = useState(false);

  const handleSentimentUpdate = (ticketId: string | null, sentiment: number) => {
    if (ticketId === null) {
      setLastThirtySentiment(sentiment);
    } else {
      setCurrentSentiment(sentiment);
    }
  };

  return (
    <div className="p-2">
      <SentimentAnalysis 
        zafClient={zafClient} 
        onSentimentUpdate={handleSentimentUpdate} 
      />
      <div className="flex flex-col space-y-2">
        <div>
          <h2 className="text-base font-semibold mb-1">Current Ticket</h2>
          {currentSentiment !== null && (
            <SentimentDisplay sentiment={currentSentiment} greyscale={greyscale} />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1">Last 30 Days</h2>
          {lastThirtySentiment !== null && (
            <SentimentDisplay sentiment={lastThirtySentiment} greyscale={greyscale} />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
