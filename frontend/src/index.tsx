import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './tailwind.css';
import { initializeApp as initializeApiService } from './services/apiService';
import { setCookie } from './services/cookieService';

declare global {
  interface Window {
    initializeApp: (client: any) => void;
  }
}

window.initializeApp = async (client) => {
  try {
    console.log('Getting form data');
    const form = document.querySelector('form');

    if (form) {
      const formData = new FormData(form);

      // Iterate over all form data entries and log them to the console
      formData.forEach((value, key) => {
        console.log(`${key}: ${value}`);
      });
    } else {
      console.error('No form found');
    }
  } catch (error) {
    console.error('Error getting form data:', error);
  }

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
