import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './tailwind.css';
import { initializeApp as initializeApiService } from './services/apiService';

const initializeApp = async () => {
  try {
    await new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js';
      script.async = true;
      script.onload = () => resolve();
      document.body.appendChild(script);
    });

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
      <div>Error: Unable to initialize the application. Please try again later.</div>,
      document.getElementById('root')
    );
  }
};

initializeApp();