import React, { useState } from 'react';
import SentimentAnalysis from './SentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';

interface AppProps {
  zafClient: any;
}

const App: React.FC<AppProps> = ({ zafClient }) => {
  const [currentSentiment, setCurrentSentiment] = useState<number | null>(null);
  const [lastThirtySentiment, setLastThirtySentiment] = useState<number | null>(null);
  const [greyscale, setGreyscale] = useState(false);

  const handleSentimentUpdate = (ticketId: string | null, sentiment: number) => {
    if (ticketId === null) {
      setLastThirtySentiment(sentiment);
    } else {
      setCurrentSentiment(sentiment);
    }
  };

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
      <SentimentAnalysis 
        zafClient={zafClient} 
        onSentimentUpdate={handleSentimentUpdate} 
      />
      <div className="flex flex-col space-y-2">
        <div>
          <h2 className="text-base font-semibold mb-1">Current Ticket</h2>
          {currentSentiment !== null && (
            <>
              <p>Raw Score: {currentSentiment.toFixed(2)}</p>
              <SentimentDisplay sentiment={currentSentiment} greyscale={greyscale} />
            </>
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold mb-1">Last 30 Days</h2>
          {lastThirtySentiment !== null && (
            <>
              <p>Raw Score: {lastThirtySentiment.toFixed(2)}</p>
              <SentimentDisplay sentiment={lastThirtySentiment} greyscale={greyscale} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
