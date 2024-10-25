import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './tailwind.css';
import './index.css';

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
  }
}

window.initializeApp = (zafClient, originalQueryString) => {
  ReactDOM.render(
    <React.StrictMode>
      <App zafClient={zafClient} originalQueryString={originalQueryString} />
    </React.StrictMode>,
    document.getElementById('root')
  );
};
