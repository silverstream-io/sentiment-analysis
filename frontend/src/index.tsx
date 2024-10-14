import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './tailwind.css';
import { initializeApp as initializeApiService } from './services/apiService';

const initializeApp = async () => {
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Zendesk App Framework SDK'));
      document.body.appendChild(script);
    });

    if (typeof ZAFClient === 'undefined') {
      throw new Error('ZAFClient is not defined');
    }

    const zafClient = await ZAFClient.init();
    await initializeApiService(zafClient);

    ReactDOM.render(
      <React.StrictMode>
        <App zafClient={zafClient} />
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

initializeApp();
