import React from 'react';
import ReactDOM from 'react-dom';
import TopbarApp from './components/TopbarApp';
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
      <TopbarApp zafClient={zafClient} originalQueryString={originalQueryString} />
    </React.StrictMode>,
    document.getElementById('root')
  );
};
