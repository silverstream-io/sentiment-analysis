import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './index.css';
import { createPineconeService } from './services/pineconeService';
import { fetchApiCredentials } from './services/apiService';

const initializeApp = async () => {
  try {
    const zafClient = await ZAFClient.init();
    const credentials = await fetchApiCredentials();

    if (credentials.AUTHORIZED && 
        credentials.PINECONE_API_KEY && 
        credentials.PINECONE_INDEX_NAME && 
        credentials.PINECONE_NAMESPACE) {
      const pineconeService = await createPineconeService(
        credentials.PINECONE_API_KEY,
        credentials.PINECONE_INDEX_NAME,
        credentials.PINECONE_NAMESPACE
      );

      ReactDOM.render(
        <React.StrictMode>
          <App pineconeService={pineconeService} />
        </React.StrictMode>,
        document.getElementById('root')
      );
    } else {
      console.error('Missing required credentials');
      // Render an error message or a different component
      ReactDOM.render(
        <div>Error: Unable to initialize the application due to missing credentials.</div>,
        document.getElementById('root')
      );
    }
  } catch (error) {
    console.error('Error initializing the application:', error);
    // Render an error message
    ReactDOM.render(
      <div>Error: Unable to initialize the application. Please try again later.</div>,
      document.getElementById('root')
    );
  }
};

initializeApp();
