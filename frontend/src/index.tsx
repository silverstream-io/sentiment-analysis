import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import './tailwind.css';
import './index.css';

// Lazy load components
const App = lazy(() => import('./components/App').catch(err => {
  console.error('Error loading App component:', err);
  return { default: () => <div>Error loading app</div> };
}));

const TopbarApp = lazy(() => import('./components/TopbarApp').catch(err => {
  console.error('Error loading TopbarApp component:', err);
  return { default: () => <div>Error loading topbar</div> };
}));

const BackgroundApp = lazy(() => import('./components/BackgroundApp').catch(err => {
  console.error('Error loading BackgroundApp component:', err);
  return { default: () => <div>Error loading background app</div> };
}));

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
  }
}

const LoadingComponent = () => (
  <div>Loading application...</div>
);

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught by boundary:', event.error);
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <div>Something went wrong. Please try refreshing the page.</div>;
  }

  return <>{children}</>;
};

window.initializeApp = (zafClient, originalQueryString) => {
  const appType = new URLSearchParams(window.location.search).get('type') || 'main';
  console.log('[Index] Initializing app type:', appType);
  
  const getComponent = () => {
    console.log('[Index] Getting component for type:', appType);
    switch(appType) {
      case 'main':
        return <App zafClient={zafClient} originalQueryString={originalQueryString} />;
      case 'topbar':
        return <TopbarApp zafClient={zafClient} originalQueryString={originalQueryString} />;
      case 'background':
        return <BackgroundApp zafClient={zafClient} originalQueryString={originalQueryString} />;
      default:
        console.error('[Index] Unknown app type:', appType);
        return <div>Unknown app type: {appType}</div>;
    }
  };

  ReactDOM.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<LoadingComponent />}>
            <Routes>
              <Route path="/" element={getComponent()} />
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
    </React.StrictMode>,
    document.getElementById('root')
  );
};
