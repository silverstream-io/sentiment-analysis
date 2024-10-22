from typing import Tuple, Dict
from flask import jsonify, request, render_template, make_response, session
from datetime import datetime
from bs4 import BeautifulSoup as bs
from services.auth_service import auth_required, session_required
from services.pinecone_service import PineconeService
import numpy as np
from models.emotions import emotions
from utils import get_subdomain
import logging
import os
import math

logger = logging.getLogger('sentiment_checker')

class Root: 
    def index(self):
        return render_template('root/index.html')

    def health(self):
        return "OK"

class SentimentChecker:
    """
    A class for handling the Sentiment Checker application.

    This class provides methods to analyze comments, retrieve ticket vectors,
    calculate sentiment scores, and serve the entry point for the Sentiment Checker
    Zendesk application.

    The class interacts with various services including:
    - PineconeService for vector operations and storage
    - Authentication service for securing endpoints
    - OpenAI service for sentiment analysis (indirectly through PineconeService)

    Methods:
        analyze_comments: Analyzes and stores sentiment for ticket comments.
        get_ticket_vectors: Retrieves vectors associated with a ticket.
        get_score: Calculates the overall sentiment score for a ticket.
        entry: Serves as the entry point for the Zendesk application.

    Each method is decorated with @auth_required to ensure proper authentication
    before processing requests.

    Note: This class assumes the existence of a Flask application context and
    uses Flask's request object for handling incoming data.
    """

    def __init__(self):
        self.logger = logger
        self.templates = 'sentiment-checker'

    
    def init(self):
        self.remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        self.subdomain, error = get_subdomain(request)
        if error:
            self.logger.error(f"Error getting subdomain: {error}, request remote addr: {self.remote_addr}")
            raise Exception(error)
        self.pinecone_service = PineconeService(self.subdomain)
        self.logger.debug(f"Initialized SentimentChecker with subdomain: {self.subdomain}, request remote addr: {self.remote_addr}")
        try:
            self.data = request.json
            self.ticket = self.data.get('ticket', {})
            self.ticket_id = self.ticket.get('ticketId')
            self.comments = self.ticket.get('comments', {})
        except Exception as e:
            self.logger.debug(f"Error getting request data: {e}, request remote addr: {self.remote_addr}")
            self.data = {}


    @session_required
    def analyze_comments(self) -> Tuple[Dict[str, str], int]:
        """
        Analyze the comments of a ticket and store them in the database.
        """
        self.init()
        self.logger.info(f"Received request for analyze_comments, request remote addr: {self.remote_addr}")

        if not self.comments or not self.ticket_id:
            self.logger.warning(f"Missing comments or ticket id in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing comments or ticket id'}), 400

        self.logger.debug(f"Processing comments for ticket: {self.ticket_id}, request remote addr: {self.remote_addr}")
        results = []
        for comment_id, comment_data in self.comments.items():
            text = comment_data.get('text', '')
            try:    
                if isinstance(comment_data.get('created_at'), str):
                    timestamp = int(datetime.fromisoformat(comment_data.get('created_at')).timestamp())
                else:
                    timestamp = int(comment_data.get('created_at').timestamp())
            except Exception as e:
                self.logger.error(f"Error getting timestamp for comment {comment_id}: {e}, request remote addr: {self.remote_addr}")
                timestamp = int(datetime.now().timestamp())
            
            if not text:
                continue

            text = bs(text, 'html.parser').get_text()
            text = ' '.join(text.split())
            vector_id = f"{self.ticket_id}#{comment_id}"

            try:
                existing_vector = self.pinecone_service.fetch_vectors([vector_id])
            except Exception as e:
                self.logger.debug(f"Error fetching vector {vector_id}: {e}, request remote addr: {self.remote_addr}")
                existing_vector = None

            if existing_vector:
                self.logger.debug(f"Existing vector found for comment {comment_id}: {existing_vector}, request remote addr: {self.remote_addr}")
                results.append({
                    'comment_id': comment_id,
                    'emotion_score': existing_vector['metadata']['emotion_score'],
                    'upserted_count': 0
                })
            else:
                self.logger.debug(f"No existing vector found for comment {comment_id}, request remote addr: {self.remote_addr}")
                embedding = self.pinecone_service.get_embedding(text)
                # Query emotions namespace
                emotion_matches = self.pinecone_service.query_vectors(embedding, 
                                                                      namespace='emotions', 
                                                                      top_k=100, 
                                                                      include_metadata=True, 
                                                                      include_values=False)
                self.logger.debug(f"Emotion matches: {emotion_matches}, request remote addr: {self.remote_addr}")
                emotion_sum = 0
                matched_count = 0
                for match in emotion_matches:
                    for emotion_name, emotion_value in match['metadata'].items():
                        if emotion_name in emotions:
                            if emotion_value:
                                emotion_sum += emotions[emotion_name].score * match['score']
                                matched_count += 1
                        else:
                            self.logger.debug(f"Emotion \"{emotion_name}\" not found in emotions dictionary or has no value. Request remote addr: {self.remote_addr}")
                self.logger.debug(f"Emotion sum for comment {comment_id}: {emotion_sum}, request remote addr: {self.remote_addr}")
                # Prepare metadata for upsert
                if matched_count > 0:   
                    emotion_score = emotion_sum / matched_count
                else:
                    emotion_score = 0
                if emotion_score > 10:
                    emotion_score = 10
                elif emotion_score < -10:
                    emotion_score = -10
                self.logger.debug(f"Emotion score for comment {comment_id}: {emotion_score}, request remote addr: {self.remote_addr}")
                metadata = {
                    'text': text,
                    'timestamp': timestamp,
                    'emotion_score': emotion_score
                }
                # Upsert vector to Zendesk subdomain namespace
                upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
                if not hasattr(upsert_response, 'upserted_count') or upsert_response.upserted_count == 0:
                    self.logger.error(f"No vector upserted for comment {comment_id}, upsert response: {upsert_response}, request remote addr: {self.remote_addr}")
                    return jsonify({'error': f'No vector upserted for comment {comment_id}'}), 500
                results.append({
                    'comment_id': comment_id,
                    'emotion_score': emotion_score,
                    'upserted_count': upsert_response.upserted_count
                })

        self.logger.debug(f"Finished processing comments for ticket: {self.ticket_id}, request remote addr: {self.remote_addr}")
        return jsonify({'message': 'Comments analyzed and stored successfully', 'results': results}), 200


    @session_required
    def get_ticket_vectors(self) -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of a ticket or tickets.
        """

        self.init()
        self.logger.info(f"Received request for get_ticket_vectors, request remote addr: {self.remote_addr}")

        if not self.ticket_id:
            self.logger.warning(f"Missing ticket id in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket id'}), 400

        vectors_list = self.pinecone_service.list_ticket_vectors(self.ticket_id)
        self.logger.debug(f"Ticket {self.ticket_id} has vectors: {vectors_list}, request remote addr: {self.remote_addr}")
        vectors_ids = [getattr(vector, 'id', vector.get('id')) if isinstance(vector, dict) else vector.id for vector in vectors_list]
        try:
            vectors = self.pinecone_service.fetch_vectors(vectors_ids)
            return jsonify({'vectors': vectors}), 200
        except Exception as e:
            self.logger.error(f"Error fetching vectors: {e}, request remote addr: {self.remote_addr}")
            return jsonify({'Error': e}), 500


    @session_required
    def get_score(self) -> Tuple[Dict[str, str], int]:
        """
        Get the weighted score of a ticket or multiple tickets based on the emotions of the comments.
        """
        self.init()
        self.logger.info(f"Received request for get_score, request remote addr: {self.remote_addr}")

        try:
            if not self.ticket_id:
                return jsonify({'error': 'Invalid or missing ticket data'}), 400
            ticket_ids = [self.ticket_id]
            if not isinstance(ticket_ids, list):
                ticket_ids = [ticket_ids]
        except Exception as e:
            self.logger.error(f"Error processing ticket data: {e}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Invalid request data'}), 400

        self.logger.debug(f"Processing {len(ticket_ids)} tickets for score calculation, request remote addr: {self.remote_addr}")
        
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 0.5  # Adjust this value to control the decay rate
        all_scores = []

        for ticket_id in ticket_ids:
            self.logger.debug(f"Processing ticket: {ticket_id}, request remote addr: {self.remote_addr}")
            vector_list = self.pinecone_service.list_ticket_vectors(str(ticket_id))
            vector_ids = [getattr(vector, 'id', vector.get('id')) if isinstance(vector, dict) else vector.id for vector in vector_list]
            comment_vectors = self.pinecone_service.fetch_vectors(vector_ids)
            
            # Sort vectors by timestamp (newest first)
            sorted_vectors = sorted(comment_vectors.items(), key=lambda x: x[1]['metadata']['timestamp'], reverse=True)
            
            if sorted_vectors:
                newest_timestamp = sorted_vectors[0][1]['metadata']['timestamp']
                
                for vector_id, vector_data in sorted_vectors:
                    if 'metadata' in vector_data and 'emotion_score' in vector_data['metadata']:
                        time_diff = (newest_timestamp - vector_data['metadata']['timestamp']) / (24 * 3600)  # Convert to days
                        weight = math.exp(-lambda_factor * time_diff)
                        score = vector_data['metadata']['emotion_score']
                        total_weighted_score += score * weight
                        total_weight += weight
                        all_scores.append(score)
                    else:
                        self.logger.debug(f"No metadata or emotion_score found for vector {vector_id}, request remote addr: {self.remote_addr}")

        if total_weight > 0:
            weighted_score = total_weighted_score / total_weight
        else:
            weighted_score = 0
        
        if all_scores:
            all_scores_np = np.array(all_scores)
            std_dev = np.std(all_scores_np)
            most_recent_score = all_scores_np[0]

            if abs(most_recent_score - weighted_score) > std_dev:
                weighted_score = most_recent_score
            elif abs(weighted_score - most_recent_score) > std_dev:
                weighted_score = most_recent_score
            
        weighted_score = max(min(weighted_score, 1), -1)
        
        self.logger.debug(f"Calculated weighted score for {len(ticket_ids)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        return jsonify({'score': weighted_score}), 200


    @auth_required
    def entry(self):
        """
        Serve the entry point for the Zendesk application.
        """

        self.init()
        self.logger.debug(f"Received request for entry point, request remote addr: {self.remote_addr}")
        
        original_query_string = request.query_string.decode()
        session_token = os.urandom(24).hex()
        session['session_token'] = session_token
        response = make_response(render_template(
            f'{self.templates}/entry.html', 
            subdomain=self.subdomain,
            original_query_string=original_query_string
        ))
        response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')

        return response

    
    def health(self):
        """
        Serve the health check page for the Zendesk application. This will:
        - Check the health of the Pinecone service
        """
        self.init()
        check_pinecone = self.pinecone_service.check_health()
        self.logger.debug(f"Pinecone health check: {check_pinecone}, request remote addr: {self.remote_addr}")
        if check_pinecone.get('status', {}).get('ready', True):  
            return render_template(f'{self.templates}/health.html')
        else:
            return jsonify({'error': 'Pinecone service is not healthy'}), 500

