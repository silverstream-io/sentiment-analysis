import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import './tailwind.css';
import './index.css';

// Create separate chunks for each app type
const apps = {
  main: React.lazy(() => import('./apps/main').then(module => ({ 
    default: module.MainApp 
  }))),
  topbar: React.lazy(() => import('./apps/topbar').then(module => ({ 
    default: module.TopbarApp 
  }))),
  background: React.lazy(() => import('./apps/background').then(module => ({ 
    default: module.BackgroundApp 
  }))),
};

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
  }
}

const LoadingComponent = () => (
  <div>Loading application...</div>
);

window.initializeApp = (zafClient, originalQueryString) => {
  const appType = new URLSearchParams(window.location.search).get('type') || 'main';
  console.log('[Index] Initializing app type:', appType);
  
  const Component = apps[appType as keyof typeof apps];
  
  if (!Component) {
    console.error('[Index] Unknown app type:', appType);
    return;
  }

  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <Suspense fallback={<LoadingComponent />}>
          <Routes>
            <Route 
              path="/" 
              element={<Component zafClient={zafClient} originalQueryString={originalQueryString} />} 
            />
          </Routes>
        </Suspense>
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
};
