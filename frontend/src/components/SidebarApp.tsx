import React, { useState, useEffect, Suspense } from 'react';
import SentimentAnalysis from './SentimentAnalysis';
import SentimentDisplay from './SentimentDisplay';
import { SentimentRange } from '../types';
import { debugLog } from '../services/apiService';

interface SidebarAppProps {
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

const SidebarApp: React.FC<SidebarAppProps> = ({ zafClient, originalQueryString }) => {
  debugLog('[SidebarApp] Initializing with ZAF client');
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

  const handleSentimentUpdate = (id: string | null, sentiment: SentimentRange) => {
    debugLog('[SidebarApp] Sentiment update received:', { id, sentiment });
    if (id === null) {
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

export default SidebarApp;
