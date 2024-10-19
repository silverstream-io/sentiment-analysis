from typing import Tuple, Dict
from flask import jsonify, request, render_template
from datetime import datetime
from services.auth_service import auth_required
from services.pinecone_service import PineconeService
from models.emotions import emotions
from utils import get_subdomain
import logging

logger = logging.getLogger('api.server')

class Root: 
    def index():
        return render_template('index.html')

    def health():
        return "OK"

class SentimentChecker:
    @auth_required
    def analyze_comments() -> Tuple[Dict[str, str], int]:
        """
        Analyze the comments of a ticket and store them in the database.
        """
        logger.info("Received request for analyze_comments")
        subdomain, error = get_subdomain(request)
        if error:
            return jsonify(error[0]), error[1]

        data = request.json
        ticket = data.get('ticket', {})
        comments = ticket.get('comments', {})
        ticket_id = ticket.get('id')
        if not comments or not ticket_id:
            logger.info("Missing comments or ticket id in request data")
            return jsonify({'error': 'Missing comments or ticket id'}), 400

        logger.info(f"Processing comments for ticket: {ticket_id}")
        pinecone_service = PineconeService(subdomain)
        results = []
    
        for comment_id, text in comments.items():
            embedding = pinecone_service.get_embedding(text)
            vector_id = f"{ticket_id}#{comment_id}"
            # Query emotions namespace
            emotion_matches = pinecone_service.query_vectors(embedding, namespace='emotions', top_k=10)
            emotion_sum = 0
            for match in emotion_matches:
                for emotion, is_present in match['metadata'].items():
                    if is_present and emotion in emotions:
                        emotion_sum += emotions[emotion].score
            
            # Prepare metadata for upsert
            metadata = {
                'text': text,
                'timestamp': int(datetime.timestamp(datetime.now())),
                'emotion_sum': emotion_sum
            }
            # Upsert vector to Zendesk subdomain namespace
            upsert_response = pinecone_service.upsert_vector(vector_id, embedding, metadata)
            results.append({
                'comment_id': comment_id,
                'upsert_response': upsert_response
            })
        
        logger.info(f"Finished processing comments for ticket: {ticket_id}")
        return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200

    @auth_required
    def get_ticket_vectors() -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of a ticket or tickets.
        """
        logger.info("Received request for get_ticket_vectors")
        subdomain, error = get_subdomain(request)
        if error:
            return jsonify(error[0]), error[1]

        data = request.json
        ticket = data.get('ticket', {})
        ticket_id = ticket.get('id')

        pinecone_service = PineconeService(subdomain)
        vectors = pinecone_service.list_ticket_vectors(ticket_id)

        return jsonify({'vectors': vectors}), 200

    @auth_required
    def get_score() -> Tuple[Dict[str, str], int]:
        """
        Get the score of a ticket or tickets based on the emotions of the comments.
        """
        logger.info("Received request for get_score")
        subdomain, error = get_subdomain(request)
        if error:
            return jsonify(error[0]), error[1]

        data = request.json
        ticket = data.get('ticket', {})
        ticket_id = ticket.get('id')

        pinecone_service = PineconeService(subdomain)
        comments = pinecone_service.list_tickets(ticket_id)
        emotion_score = 0 
        for comment in comments:
            emotion_score += comment['metadata']['emotion_sum']
        emotion_score = emotion_score / len(comments)

        logger.info(f"Calculated score: {emotion_score}")
        return jsonify({'score': emotion_score}), 200

    @auth_required
    def entry():
        logger.info("Received request for entry point")
        
        # Extract subdomain from the origin URL
        origin = request.args.get('origin', '')
        subdomain = origin.split('//')[1].split('.')[0] if '//' in origin else ''
        logger.info(f"Extracted subdomain: {subdomain}")

        form_data = request.form

        return render_template('index.html', subdomain=subdomain, form_data=dict(form_data))
