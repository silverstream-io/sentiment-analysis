import React from 'react';
import ReactDOM from 'react-dom';
import BackgroundApp from './components/BackgroundApp';
import { initializeApp as initializeApiService } from './services/apiService';

window.initializeBackgroundApp = async (client) => {
  try {
    console.log('Starting background app initialization');
    await initializeApiService(client, '');
    console.log('API service initialized');

    ReactDOM.render(
      <React.StrictMode>
        <BackgroundApp zafClient={client} />
      </React.StrictMode>,
      document.getElementById('root')
    );
    console.log('BackgroundApp rendered');

    // Add a test event listener here
    client.on('ticket.saved', (data: any) => {
      console.log('Test: ticket ' + data.ticket.id + ' saved!');
    });
    console.log('Test event listener added');

    console.log('Background app initialization completed');
  } catch (error) {
    console.error('Error initializing the background application:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
};
