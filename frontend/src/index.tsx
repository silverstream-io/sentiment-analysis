import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './tailwind.css';
import { initializeApp as initializeApiService } from './services/apiService';

declare global {
  interface Window {
    initializeApp: (client: any) => void;
  }
}

window.initializeApp = async (client) => {
  try {
    await initializeApiService(client);

    ReactDOM.render(
      <React.StrictMode>
        <App zafClient={client} />
      </React.StrictMode>,
      document.getElementById('root')
    );
  } catch (error) {
    console.error('Error initializing the application:', error);
    ReactDOM.render(
      <div className="error-message">
        Error: Unable to initialize the application. Please check the console for more details.
      </div>,
      document.getElementById('root')
    );
  }
};
