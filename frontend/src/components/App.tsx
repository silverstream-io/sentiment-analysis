import React, { useState } from 'react';
// Only import SentimentAnalysis in the main App
const SentimentAnalysis = React.lazy(() => import('./SentimentAnalysis'));
import SentimentDisplay from './SentimentDisplay';
import { SentimentRange } from '../types';

interface AppProps {
  zafClient: any;
  originalQueryString: string;
}

const App: React.FC<AppProps> = ({ zafClient, originalQueryString }) => {
  const [currentSentiment, setCurrentSentiment] = useState<SentimentRange | null>(null);
  const [lastThirtySentiment, setLastThirtySentiment] = useState<SentimentRange | null>(null);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [greyscale] = useState(false);

  const handleSentimentUpdate = (ticketId: string | null, sentiment: SentimentRange) => {
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
                <SentimentDisplay sentiment={currentSentiment} greyscale={greyscale} />
              </>
            )}
          </div>
          <div>
            <h2 className="text-base font-semibold mb-1">Last 30 Days</h2>
            {lastThirtySentiment !== null && (
              <>
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
