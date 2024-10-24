import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
  ReactDOM.render(
    <React.StrictMode>
      <Router>
        <Routes>
          <Route path="/" element={<App zafClient={zafClient} />} />
          <Route path="/topbar" element={<TopbarApp zafClient={zafClient} />} />
          <Route path="/background" element={<BackgroundApp zafClient={zafClient} />} />
        </Routes>
      </Router>
    </React.StrictMode>,
    document.getElementById('root')
  );
};
