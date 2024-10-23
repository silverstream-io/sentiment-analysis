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
    console.log('Background app initialized successfully');

    // Add a test event listener here
    client.on('ticket.saved', (data: any) => {
      console.log('Test: ticket ' + data.ticket.id + ' saved!');
    });
  } catch (error) {
    console.error('Error initializing the background application:', error);
  }
};

