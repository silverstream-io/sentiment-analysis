import React from 'react';
import ReactDOM from 'react-dom';
import BackgroundApp from './components/BackgroundApp';
import { initializeApp as initializeApiService } from './services/apiService';

window.initializeBackgroundApp = async (client) => {
  try {
    await initializeApiService(client, '');

    ReactDOM.render(
      <React.StrictMode>
        <BackgroundApp zafClient={client} />
      </React.StrictMode>,
      document.getElementById('root')
    );
  } catch (error) {
    console.error('Error initializing the background application:', error);
  }
};

