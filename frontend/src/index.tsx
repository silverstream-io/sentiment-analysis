import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import App from './components/App';
import TopbarApp from './components/TopbarApp';
import BackgroundApp from './components/BackgroundApp';
import './tailwind.css';

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
  }
}

window.initializeApp = (zafClient, originalQueryString) => {
  const appType = new URLSearchParams(window.location.search).get('type') || 'main';
  // Pass originalQueryString to the App component
  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <Routes>
          <Route path="/" element={
            appType === 'main' ? <App zafClient={zafClient} originalQueryString={originalQueryString} /> :
            appType === 'topbar' ? <TopbarApp zafClient={zafClient} originalQueryString={originalQueryString} /> :
            appType === 'background' ? <BackgroundApp zafClient={zafClient} originalQueryString={originalQueryString} /> :
            null
          } />
        </Routes>
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
};
