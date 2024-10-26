import React, { useState, Suspense, useEffect } from 'react';
import SentimentAnalysis from './SentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';
import { SentimentRange } from '../types';

interface AppProps {
  zafClient: any;
  originalQueryString: string;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Error: {this.state.error?.message || 'Something went wrong'}</div>;
    }

    return this.props.children;
  }
}

const App: React.FC<AppProps> = ({ zafClient, originalQueryString }) => {
  console.log('[App] Initializing with ZAF client');
  const [currentSentiment, setCurrentSentiment] = useState<SentimentRange | null>(null);
  const [lastThirtySentiment, setLastThirtySentiment] = useState<SentimentRange | null>(null);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [greyscale] = useState(false);

  // Add height adjustment when sentiment updates
  useEffect(() => {
    if (isAnalysisComplete && zafClient) {
      zafClient.invoke('resize', { width: '100%', height: '600px' });
    }
  }, [isAnalysisComplete, zafClient]);

  const handleSentimentUpdate = (ticketId: string | null, sentiment: SentimentRange) => {
    console.log('[App] Sentiment update received:', { ticketId, sentiment });
    if (ticketId === null) {
      setLastThirtySentiment(sentiment);
    } else {
      setCurrentSentiment(sentiment);
    }
    setIsAnalysisComplete(true);
  };

  return (
    <ErrorBoundary>
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
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
