from flask import Flask, request, jsonify
from functools import wraps
from api.openai import analyze_sentiment
from services.pinecone_service import PineconeService

app = Flask(__name__)

def validate_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('Authorization')
        if api_key and api_key.startswith('Bearer '):
            api_key = api_key.split('Bearer ')[1]
            if is_valid_api_key(api_key):
                return f(*args, **kwargs)
        return jsonify({'error': 'Unauthorized'}), 401
    return decorated_function

def is_valid_api_key(api_key):
    # TODO: Implement actual API key validation
    return True  # Placeholder: always return True for now

@app.route('/analyze_sentiment', methods=['POST'])
@validate_api_key
def analyze_comment_sentiment():
    data = request.json
    
    if not all(key in data for key in ['ticket_id', 'comment_id', 'customer_id', 'agent_id', 'text']):
        return jsonify({'error': 'Missing required fields'}), 400

    ticket_id = data['ticket_id']
    comment_id = data['comment_id']
    customer_id = data['customer_id']
    agent_id = data['agent_id']
    text = data['text']

    # Analyze sentiment
    sentiment_score = analyze_sentiment(text)

    # Store the embedding
    pinecone_service = PineconeService(customer_id)
    embedding = pinecone_service.get_embedding(text)
    metadata = {
        'ticket_id': ticket_id,
        'comment_id': comment_id,
        'customer_id': customer_id,
        'agent_id': agent_id,
        'text': text,
        'sentiment': sentiment_score
    }
    pinecone_service.upsert_vector(f"{ticket_id}#{comment_id}", embedding, metadata)

    response = {
        'ticket_id': ticket_id,
        'comment_id': comment_id,
        'sentiment': sentiment_score
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)
