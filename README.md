# Sentiment Checker

Sentiment Checker is a powerful tool that provides real-time sentiment analysis for your Zendesk tickets. Leverage AI and machine learning to understand your customers' sentiments and improve their experience.

## Features

- Real-time sentiment analysis of ticket comments
- Historical sentiment tracking for the last 30 days
- Visual representation of sentiment scores
- Greyscale mode for accessibility
- Seamless integration with Zendesk Support

## Technology Stack

- Backend: Python with Flask
- Frontend: React with TypeScript
- AI/ML: OpenAI for sentiment analysis
- Vector Database: Pinecone
- Authentication: JWT and session-based auth

## Installation

1. Clone the repository
2. Install backend dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. Build and install frontend dependencies:

   ```bash
   ./dobuild.sh
   ```

## Configuration

1. Set up environment variables:
   - Create a `.env` file in the `backend` directory
   - Add the following variables:

     ```bash
     SECRET_KEY=your_secret_key
     OPENAI_API_KEY=your_openai_api_key
     PINECONE_API_KEY=your_pinecone_api_key
     PINECONE_INDEX=your_pinecone_index_name
     ZENDESK_APP_AUD=your_zendesk_app_audience
     ZENDESK_APP_PUBLIC_KEY=your_zendesk_app_public_key
     ```

    See the [Zendesk documentation](https://developer.zendesk.com/documentation/apps/build-an-app/building-a-server-side-app/part-5-secure-the-app/) for more information on how to get these values.

2. Configure Zendesk app settings:
   - Update the `manifest.json` file with your app details

## Running the Application

1. Start the backend server:

   ```bash
   cd backend/src
   python api/run.py
   ```

2. Start the frontend development server:

   ```bash
   cd frontend
   npm start
   ```

3. Build the Zendesk app:

   ```bash
   cd app
   zcli apps:create
   ```

## Usage

1. Install the Sentiment Checker app in your Zendesk account
2. Open a ticket in Zendesk Support
3. The Sentiment Checker will appear in the ticket sidebar
4. View real-time sentiment analysis for the current ticket and historical data

## Development

### Backend

The main backend logic is implemented in the `SentimentChecker` class:

```python
python:backend/src/api/views.py
startLine: 21
endLine: 57
```

### Frontend

The main frontend component is implemented in `SentimentAnalysis.tsx`:

```typescript
typescript:frontend/src/components/SentimentAnalysis.tsx
startLine: 1
endLine: 9
```

### Zendesk API Integration

The Zendesk API integration is handled by the frontend's use of the ZAFClient. See the [Zendesk documentation](https://developer.zendesk.com/documentation/apps/build-an-app/building-a-client-side-app/part-3-use-the-zaf-client/) for more information.

### Zendesk App Integration

The Zendesk app is implemented in the `app` directory. Be sure to update the `manifest.json` file with the correct app details including the correct `app_settings_url`.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License - see the [LICENSE.md](LICENSE.md) file for details.

## Support

For support, please email <support@silverstream.io> or open an issue in the GitHub repository.
