import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import './tailwind.css';
import './index.css';

import SidebarApp from './components/SidebarApp';
import TopbarApp from './components/TopbarApp';
import BackgroundApp from './components/BackgroundApp';
import NavBarApp from './components/NavBarApp';

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
    APP_CONTEXT: {
      needsTicketContext: boolean;
    };
  }
}

window.initializeApp = (zafClient, originalQueryString) => {
  const appType = new URLSearchParams(window.location.search).get('type') || 'sidebar';
  console.log('[Index] Initializing app type:', appType);

  // Define APP_CONTEXT before rendering
  window.APP_CONTEXT = {
    needsTicketContext: appType === 'sidebar'
  };

  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <Routes>
          <Route path="/sidebar" element={<SidebarApp zafClient={zafClient} originalQueryString={originalQueryString} />} />
          <Route path="/topbar" element={<TopbarApp zafClient={zafClient} originalQueryString={originalQueryString} />} />
          <Route path="/navbar" element={<NavBarApp zafClient={zafClient} originalQueryString={originalQueryString} />} />
          <Route path="/background" element={<BackgroundApp zafClient={zafClient} originalQueryString={originalQueryString} />} />
          <Route path="/" element={<SidebarApp zafClient={zafClient} originalQueryString={originalQueryString} />} />
        </Routes>
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
};
