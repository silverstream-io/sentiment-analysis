import React from 'react';
import ReactDOM from 'react-dom';
import Topbar from './components/Topbar';
import { initializeApp as initializeApiService } from './services/apiService';

window.initializeTopbarApp = async (client: any, originalQueryString: string) => {
  try {
    await initializeApiService(client, originalQueryString);

    ReactDOM.render(
      <React.StrictMode>
        <Topbar zafClient={client} />
      </React.StrictMode>,
      document.getElementById('root')
    );
  } catch (error) {
    console.error('Error initializing the topbar application:', error);
  }
};

