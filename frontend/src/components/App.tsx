import React, { useState } from 'react';
import SentimentAnalysis from './SentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';

interface AppProps {
  zafClient: any;
}

const App: React.FC<AppProps> = ({ zafClient }) => {
  const [currentSentiment, setCurrentSentiment] = useState<number | null>(null);
  const [lastThirtySentiment, setLastThirtySentiment] = useState<number | null>(null);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [greyscale] = useState(false);

  const handleSentimentUpdate = (ticketId: string | null, sentiment: number) => {
    if (ticketId === null) {
      setLastThirtySentiment(sentiment);
    } else {
      setCurrentSentiment(sentiment);
    }
    setIsAnalysisComplete(true);
  };

  return (
    <div className="p-2">
      <SentimentAnalysis 
        zafClient={zafClient} 
        onSentimentUpdate={handleSentimentUpdate} 
      />
      {isAnalysisComplete && (
        <div className="flex flex-col space-y-2">
          <div>
            <h2 className="text-base font-semibold mb-1">Current Ticket</h2>
            {currentSentiment !== null && (
              <>
                <p className="text-sm mb-1">Raw Score: {currentSentiment.toFixed(2)}</p>
                <SentimentDisplay sentiment={currentSentiment} greyscale={greyscale} />
              </>
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold mb-1">Last 30 Days</h2>
            {lastThirtySentiment !== null && (
              <>
                <p className="text-sm mb-1">Raw Score: {lastThirtySentiment.toFixed(2)}</p>
                <SentimentDisplay sentiment={lastThirtySentiment} greyscale={greyscale} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
