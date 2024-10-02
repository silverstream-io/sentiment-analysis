import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import './index.css';
import { createPineconeService } from './services/pineconeService';

createPineconeService('your-api-key-here').then((pineconeService) => {
  ReactDOM.render(
    <React.StrictMode>
      <App pineconeService={pineconeService} />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
