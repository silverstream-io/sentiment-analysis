import React from 'react';
import ReactDOM from 'react-dom';
import NavBarApp from './components/NavBarApp';
import './tailwind.css';
import './index.css';

declare global {
  interface Window {
    initializeApp: (client: any, originalQueryString: string) => void;
  }
}

window.initializeApp = (zafClient, originalQueryString) => {
  // Extract selected range from query string
  const params = new URLSearchParams(originalQueryString);
  const selectedRange = params.get('selected_range') as 'negative' | 'neutral' | 'positive' | undefined;

  ReactDOM.render(
    <React.StrictMode>
      <NavBarApp 
        zafClient={zafClient} 
        originalQueryString={originalQueryString}
        selectedRange={selectedRange}
      />
    </React.StrictMode>,
    document.getElementById('root')
  );
};
