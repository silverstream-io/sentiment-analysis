from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from ..services.pinecone_service import PineconeService
import dotenv, os

dotenv.load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:4567", "https://d3v-silverstream.zendesk.com"]}}, supports_credentials=True)

@app.route('/api/analyze-comments', methods=['POST'])
def analyze_comments():
    api_key = request.headers.get('Authorization')
    if not api_key or not api_key.startswith('Bearer '):
        return jsonify({'error': 'Invalid API key'}), 401
    
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    comments = data.get('comments', {})
    ticket_id = data.get('ticket_id')
    
    if not comments or not ticket_id:
        return jsonify({'error': 'Missing comments or ticket_id'}), 400
    
    pinecone_service = PineconeService(subdomain)
    results = []
    
    for comment_id, text in comments.items():
        embedding = pinecone_service.get_embedding(text)
        vector_id = f"{ticket_id}#{comment_id}"
        
        # Query emotions namespace
        emotion_matches = pinecone_service.query_vectors(embedding, namespace='emotions', top_k=10)
        emotion_metadata = {
            match['id']: match['metadata']
            for match in emotion_matches
            if 'emotion' in match['metadata']
        }
        
        # Prepare metadata for upsert
        metadata = {
            'text': text,
            'emotions': emotion_metadata
        }
        
        # Upsert vector to Zendesk subdomain namespace
        upsert_response = pinecone_service.upsert_vector(vector_id, embedding, metadata)
        
        results.append({
            'comment_id': comment_id,
            'emotions': emotion_metadata,
            'upsert_response': upsert_response
        })
    
    return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

@app.route('/api/analyze-sentiment', methods=['POST'])
def analyze_sentiment():
    api_key = request.headers.get('Authorization')
    if not api_key or not api_key.startswith('Bearer '):
        return jsonify({'error': 'Invalid API key'}), 401
    
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        return jsonify({'error': 'Missing Zendesk subdomain'}), 400

    data = request.json
    comments = data.get('customerComments', [])
    
    # Implement your sentiment analysis logic here
    # Use the subdomain for any Zendesk API calls if needed

    # Placeholder response
    sentiment = 'neutral'

    return jsonify({'sentiment': sentiment}), 200

if __name__ == '__main__':
    app.run(debug=True)
