from typing import Tuple, Dict, Any
from flask import jsonify, request, render_template, make_response, session
from flask import jsonify, request, render_template, make_response, session
from datetime import datetime
from bs4 import BeautifulSoup as bs
from services.auth_service import auth_required, session_required
from bs4 import BeautifulSoup as bs
from services.auth_service import auth_required, session_required
from services.pinecone_service import PineconeService
import numpy as np
import numpy as np
from models.emotions import emotions
from utils import get_subdomain
import logging
import os
import math
import os
import math

logger = logging.getLogger('sentiment_checker')
logger = logging.getLogger('sentiment_checker')

class Root: 
    def index(self):
        return render_template('root/index.html')
class Root: 
    def index(self):
        return render_template('root/index.html')

    def health(self):
        return "OK"
    def health(self):
        return "OK"

class SentimentChecker:
    """
    A class for handling the Sentiment Checker application.

    This class provides methods to analyze comments, retrieve ticket vectors,
    calculate sentiment scores, and serve the entry point for the Sentiment Checker
    Zendesk application.

    Methods are organized in the following groups:
    1. Initialization and Entry Points
    2. Analysis Methods
    3. Data Retrieval Methods
    4. Health Check
    """

    def __init__(self):
        self.logger = logger
        self.templates = 'sentiment-checker'
        self.debug_mode = os.environ.get('SENTIMENT_CHECKER_DEBUG') == 'true'
        if self.debug_mode:
            self.logger.info("Running in debug mode with localtunnel")

    def init(self):
        self.remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        self.subdomain, error = get_subdomain(request)
        if error:
            self.logger.error(f"Error getting subdomain: {error}, request remote addr: {self.remote_addr}")
            raise Exception(error)
        
        # Log the subdomain being used
        self.logger.info(f"Using subdomain: {self.subdomain} for request from {self.remote_addr}")
        
        if request.method == 'POST':
            if request.is_json:
                self.logger.info(f"Received JSON data for background_refresh")
                self.data = request.get_json()
            elif request.form:
                self.logger.info(f"Received form data for background_refresh")
                self.data = request.form.to_dict()
            elif request.data:
                self.logger.info(f"Received data for background_refresh")
                self.data = request.data.decode('utf-8')
            else:
                self.logger.warning(f"Received unknown data for background_refresh")
                self.data = None 
        else:
            self.logger.warning(f"Received unknown method for init")
            return jsonify({'error': 'Unknown method'}), 400
        self.pinecone_service = PineconeService(self.subdomain)
        self.logger.debug(f"Initialized SentimentChecker with subdomain: {self.subdomain}, request remote addr: {self.remote_addr}")
        self.ticket_ids = []
        if 'ticket' in self.data:
            if isinstance(self.data['ticket'], str):
                self.ticket_ids.append(self.data['ticket'])
            elif isinstance(self.data['ticket'], dict) and 'ticketId' in self.data['ticket']:
                self.ticket_ids.append(self.data['ticket']['ticketId'])
        if 'tickets' in self.data:
            if isinstance(self.data['tickets'], list):
                self.ticket_ids.extend([str(ticket) for ticket in self.data['tickets'] if isinstance(ticket, (str, int))])
            elif isinstance(self.data['tickets'], dict):
                self.ticket_ids.extend([str(ticket_id) for ticket_id in self.data['tickets'].keys()])
            self.ticket_ids = list(set(self.ticket_ids))  # Remove duplicates
        
        if not self.ticket_ids and not request.form:
            self.logger.warning(f"Missing ticket id(s) in request data, data is {self.data}, request remote addr: {self.remote_addr}")
        self.original_query_string = request.query_string.decode()

    # Entry Points
    @auth_required
    def entry(self):
        """
        Serve the entry point for the Zendesk application.
        """
        self.init()
        self.logger.debug(f"Received request for entry point, request remote addr: {self.remote_addr}")
        
        self.logger.debug(f"Data is {self.data}")
        session_token = os.urandom(24).hex()
        session['session_token'] = session_token

        if self.debug_mode:
            # In debug mode, render template that loads from localtunnel
            response = make_response(render_template(
                f'{self.templates}/entry_debug.html', 
                subdomain=self.subdomain,
                original_query_string=self.original_query_string
            ))
        else:
            # In production mode, use static files
            response = make_response(render_template(
                f'{self.templates}/entry.html', 
                subdomain=self.subdomain,
                original_query_string=self.original_query_string
            ))

        response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')
        return response

    @auth_required
    def background_refresh(self):
        self.init()
        if self.debug_mode:
            template = f'{self.templates}/background_debug.html'
        else:
            template = f'{self.templates}/background.html'
            
        response = make_response(render_template(
            template,
            subdomain=self.subdomain,
            original_query_string=self.original_query_string
        ))
        return response
    
    @auth_required
    def topbar(self):
        self.init()
        self.logger.info(f"Received request for topbar, request remote addr: {self.remote_addr}")
        
        if self.debug_mode:
            template = f'{self.templates}/topbar_debug.html'
        else:
            template = f'{self.templates}/topbar.html'
            
        response = make_response(render_template(
            template,
            subdomain=self.subdomain,
            original_query_string=self.original_query_string
        ))
        return response

    # Analysis Methods
    def _analyze(self, ticket_id: str, comment: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a single comment and store the result in the database.
        
        Args:
            ticket_id: The ID of the ticket containing the comment
            comment: Dict containing comment data with format:
                    {'id': str, 'text': str, 'created_at': str}
                    
        Returns:
            Dict containing the analysis results
        """
        comment_id = comment['id']
        text = comment['text']
        
        try:    
            if isinstance(comment['created_at'], str):
                timestamp = int(datetime.fromisoformat(comment['created_at'].replace('Z', '+00:00')).timestamp())
            else:
                self.logger.error(f"Invalid created_at format for comment {comment_id}, created_at: {comment['created_at']}, request remote addr: {self.remote_addr}")
                raise ValueError(f"Invalid created_at format for comment {comment_id}")
        except Exception as e:
            self.logger.error(f"Error getting timestamp for comment {comment_id}: {e}, request remote addr: {self.remote_addr}")
            timestamp = int(datetime.now().timestamp())
        
        if not text:
            return None

        text = bs(text, 'html.parser').get_text()
        text = ' '.join(text.split())
        vector_id = f"{ticket_id}#{comment_id}"

        try:
            existing_vector = self.pinecone_service.fetch_vector(vector_id)
        except Exception as e:
            self.logger.debug(f"Error fetching vector {vector_id}: {e}, request remote addr: {self.remote_addr}")
            existing_vector = None

        if existing_vector:
            self.logger.debug(f"Existing vector found for comment {comment_id}: {existing_vector}, request remote addr: {self.remote_addr}")
            if 'metadata' in existing_vector and 'emotion_score' in existing_vector['metadata']:
                return {
                    'comment_id': comment_id,
                    'emotion_score': existing_vector['metadata']['emotion_score'],
                    'upserted_count': 0
                }
            else:
                self.logger.debug(f"No metadata or emotion_score found for vector {vector_id}, request remote addr: {self.remote_addr}")
        
        # If no existing vector or invalid metadata, create new analysis
        embedding = self.pinecone_service.get_embedding(text)
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
                else:
                    self.logger.debug(f"Emotion \"{emotion_name}\" not found in emotions dictionary or has no value. Request remote addr: {self.remote_addr}")

        self.logger.debug(f"Emotion sum for comment {comment_id}: {emotion_sum}, request remote addr: {self.remote_addr}")
        
        if matched_count > 0:   
            emotion_score = emotion_sum / matched_count
        else:
            emotion_score = 0
            
        emotion_score = max(min(emotion_score, 10), -10)
        
        self.logger.debug(f"Emotion score for comment {comment_id}: {emotion_score}, request remote addr: {self.remote_addr}")
        
        metadata = {
            'text': text,
            'timestamp': timestamp,
            'emotion_score': emotion_score
        }
        
        upsert_response = self.pinecone_service.upsert_vector(vector_id, embedding, metadata)
        
        if not hasattr(upsert_response, 'upserted_count') or upsert_response.upserted_count == 0:
            self.logger.error(f"No vector upserted for comment {comment_id}, upsert response: {upsert_response}, request remote addr: {self.remote_addr}")
            raise Exception(f'No vector upserted for comment {comment_id}')
            
        return {
            'comment_id': comment_id,
            'emotion_score': emotion_score,
            'upserted_count': upsert_response.upserted_count
        }

    @session_required
    def analyze_comments(self) -> Tuple[Dict[str, str], int]:
        """
        Analyze the comments of one or more tickets and store them in the database.
        """
        self.init()
        self.logger.info(f"Received request for analyze_comments, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        all_results = []
        for ticket_id in self.ticket_ids:
            self.logger.debug(f"Processing comments for ticket: {ticket_id}, request remote addr: {self.remote_addr}")
            comments = self.data.get('tickets', {}).get(ticket_id, {}).get('comments', {})
            
            if not comments:
                self.logger.warning(f"No comments found for ticket {ticket_id}, request remote addr: {self.remote_addr}")
                continue

            for comment_id, comment_data in comments.items():
                try:
                    formatted_comment = {
                        'id': comment_id,
                        'text': comment_data.get('text', ''),
                        'created_at': comment_data.get('created_at')
                    }
                    result = self._analyze(ticket_id, formatted_comment)
                    if result:
                        all_results.append(result)
                except Exception as e:
                    self.logger.error(f"Error analyzing comment {comment_id}: {e}, request remote addr: {self.remote_addr}")
                    continue

        self.logger.debug(f"Finished processing comments for tickets: {self.ticket_ids}, request remote addr: {self.remote_addr}")
        return jsonify({'message': 'Comments analyzed and stored successfully', 'results': all_results}), 200

    @session_required
    def update_sentiment(self) -> Tuple[Dict[str, Any], int]:
        """
        Update sentiment for new comments on a ticket.
        """
        self.init()
        self.logger.info(f"Received request for update_sentiment, request remote addr: {self.remote_addr}")
        
        ticket_id = self.data.get('ticket_id')
        comments = self.data.get('comments', [])
        
        if not ticket_id or not comments:
            self.logger.warning(f"Missing ticket_id or comments in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket_id or comments'}), 400
            
        existing_vectors = self.pinecone_service.list_ticket_vectors(ticket_id)
        existing_comment_ids = set(vector['id'].split('#')[1] for vector in existing_vectors)
        new_comments = [comment for comment in comments if str(comment['id']) not in existing_comment_ids]
        
        results = []
        for comment in new_comments:
            try:
                formatted_comment = {
                    'id': str(comment['id']),
                    'text': comment['value'],
                    'created_at': comment['created_at']
                }
                result = self._analyze(ticket_id, formatted_comment)
                if result:
                    results.append(result)
            except Exception as e:
                self.logger.error(f"Error analyzing comment {comment['id']}: {e}, request remote addr: {self.remote_addr}")
                continue
                
        return jsonify({
            'message': 'Sentiment updated successfully',
            'results': results,
            'new_comments_count': len(new_comments)
        }), 200

    # Data Retrieval Methods
    @session_required
    def get_ticket_vectors(self) -> Tuple[Dict[str, str], int]:
        """
        Get the vectors of one or more tickets.
        """
        self.init()
        self.logger.info(f"Received request for get_ticket_vectors, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        all_vectors = {}
        for ticket_id in self.ticket_ids:
            vectors_list = self.pinecone_service.list_ticket_vectors(ticket_id)
            self.logger.debug(f"Ticket {ticket_id} has vectors: {vectors_list}, request remote addr: {self.remote_addr}")
            vector_ids = [getattr(vector, 'id', vector.get('id')) if isinstance(vector, dict) else vector.id for vector in vectors_list]
            try:
                all_vectors[ticket_id] = self.pinecone_service.fetch_vectors(vector_ids)
            except Exception as e:
                self.logger.error(f"Error fetching vectors for ticket {ticket_id}: {e}, request remote addr: {self.remote_addr}")

        return jsonify({'vectors': all_vectors}), 200

    @session_required
    def get_score(self, ticket_id: str = None) -> Tuple[Dict[str, str], int]:
        """
        Get the weighted score of a ticket or multiple tickets based on the emotions of the comments.
        """
        self.init()
        self.logger.info(f"Received request for get_score, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        self.logger.debug(f"Processing {len(self.ticket_ids)} tickets for score calculation, request remote addr: {self.remote_addr}")
        
        total_weighted_score = 0
        total_weight = 0
        lambda_factor = 1.0 # Adjust this value to control the decay rate
        all_scores = []
        if ticket_id:
            ticket_ids = [ticket_id]
        else:
            ticket_ids = self.ticket_ids

        for ticket_id in ticket_ids:
            vector_ids, comment_vectors = [], []
            self.logger.info(f"Processing ticket: {ticket_id}, request remote addr: {self.remote_addr}")
            vector_list = self.pinecone_service.list_ticket_vectors(str(ticket_id))
            for vector in vector_list:
                vector_ids.append(vector.id if hasattr(vector, 'id') else vector.get('id'))
            response = self.pinecone_service.fetch_vectors(vector_ids)
            if len(response.values()) > 0:
                comment_vectors.append(response)
                self.logger.info(f"Fetched vectors: {comment_vectors}")
            else:
                self.logger.warning(f"No vectors found for ticket {ticket_id}") 
                continue

            if len(comment_vectors) == 0:
                self.logger.warning(f"No vectors found for tickets: {self.ticket_ids}")
                self.logger.info(f"namespace: {self.pinecone_service.namespace}")
                return jsonify({'score': 0}), 200

            sorted_vectors = sorted(comment_vectors[0].items(), key=lambda x: x[1]['metadata']['timestamp'], reverse=True)
            self.logger.info(f"Sorted vectors: {sorted_vectors}")

            if sorted_vectors:
                newest_timestamp = sorted_vectors[0][1]['metadata']['timestamp']
                self.logger.info(f"Newest timestamp: {newest_timestamp}")
                
                for vector_id, vector_data in sorted_vectors:
                    if 'metadata' in vector_data and 'emotion_score' in vector_data['metadata']:
                        time_diff = (newest_timestamp - vector_data['metadata']['timestamp']) / (24 * 3600)  # Convert to days
                        weight = math.exp(-lambda_factor * time_diff)
                        score = vector_data['metadata']['emotion_score']
                        total_weighted_score += score * weight
                        total_weight += weight
                        all_scores.append(score)
                        self.logger.info(f"Vector {vector_id}: score={score}, weight={weight}")
                    else:
                        self.logger.warning(f"No metadata or emotion_score found for vector {vector_id}")

        if total_weight > 0:
            weighted_score = total_weighted_score / total_weight
        else:
            weighted_score = 0
        
        if all_scores:
            all_scores_np = np.array(all_scores)
            std_dev = np.std(all_scores_np)
            most_recent_score = all_scores[0]
            self.logger.info(f"Most recent score: {most_recent_score}, weighted score: {weighted_score}, std_dev: {std_dev}")

            if most_recent_score < weighted_score and abs(weighted_score - most_recent_score) > std_dev:
                weighted_score = most_recent_score
            elif most_recent_score > weighted_score and abs(most_recent_score - weighted_score) > std_dev:
                weighted_score = most_recent_score
            
        weighted_score = max(min(weighted_score, 1), -1)
        
        self.logger.info(f"Calculated weighted score for {len(self.ticket_ids)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        #self.logger.debug(f"Calculated weighted score for {len(self.ticket_ids)} tickets: {weighted_score}, request remote addr: {self.remote_addr}")
        return jsonify({'score': weighted_score}), 200

    @session_required
    def get_scores(self) -> Tuple[Dict[str, str], int]:
        self.init()
        self.logger.info(f"Received request for get_scores, request remote addr: {self.remote_addr}")

        if not self.ticket_ids:
            self.logger.warning(f"Missing ticket ids in request data, data is {self.data}, request remote addr: {self.remote_addr}")
            return jsonify({'error': 'Missing ticket ids'}), 400

        scores = {}
        for ticket_id in self.ticket_ids:
            score = self.get_score(ticket_id)
            scores[ticket_id] = score

        return jsonify({'scores': scores}), 200

    # Health Check
    def health(self):
        """
        Serve the health check page for the Zendesk application.
        """
        remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
        pinecone_service = PineconeService('emotions')
        check_pinecone = pinecone_service.check_health()
        self.logger.debug(f"Pinecone health check: {check_pinecone}, request remote addr: {remote_addr}")
        if check_pinecone.get('status', {}).get('ready', True):  
            return render_template(f'{self.templates}/health.html')
        else:
            return jsonify({'error': 'Pinecone service is not healthy'}), 500



