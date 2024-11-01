from functools import wraps
from flask import session, request, jsonify, make_response
from config.redis_config import RedisClient, RedisConfigError
from services.pinecone_service import PineconeService
from utils import get_subdomain, check_element, return_response, return_render
from models import TicketInput
import jwt
import os
import logging

logger = logging.getLogger('auth_service')

def verify_jwt(token):
    logger.debug(f"Verifying JWT: {token[:10]}...")  # Log first 10 characters of token
    if not token:
        logger.warning(f"Missing token, request remote addr: {request.remote_addr}")
        return 'Missing token'
    try:
        key = os.environ.get('ZENDESK_APP_PUBLIC_KEY')
        audience = os.environ.get('ZENDESK_APP_AUD')
        logger.debug(f"Key: {key[:10]}...")
        logger.debug(f"Audience: {audience}")
        if not key or not audience:
            logger.error(f"Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables, request remote addr: {request.remote_addr}")
            return 'Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables'
        algorithms = ['RS256','HS256']
        failed = []
        for algorithm in algorithms:    
            try:
                payload = jwt.decode(token, key, algorithms=[algorithm], audience=audience, leeway=30)
                return payload
            except jwt.InvalidAlgorithmError as e:
                logger.warning(f"Invalid algorithm: {str(e)}, request remote addr: {request.remote_addr}")
                failed.append(algorithm)
        if failed:
            logger.warning(f"Failed to verify JWT with algorithms: {failed}, request remote addr: {request.remote_addr}")
            return f'Failed to verify JWT with algorithms: {failed}'
    except jwt.ExpiredSignatureError:
        logger.warning(f"Token has expired, request remote addr: {request.remote_addr}")
        return 'Token has expired'
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}, request remote addr: {request.remote_addr}")
        return f'Invalid token: {str(e)}'

def init_required(f):
    @wraps(f)
    def decorated_function(self, *args, **kwargs):
        try:
            # Get subdomain and check for errors
            self.original_query_string = request.query_string.decode()
            self.remote_addr = request.headers.get('X-Forwarded-For', request.remote_addr)
            self.subdomain, error = get_subdomain(request)
            
            if error:
                self.logger.error(f"Error getting subdomain: {error}, request remote addr: {self.remote_addr}")
                return return_response({'Error in init': error}), 400 

            # Check for valid session
            if not session.get('subdomain'):
                # No session exists - check for token
                token = None
                    
                if check_element(self.data, 'token')[0]:
                    token = self.data.get('token')
                    
                if not token:
                    self.logger.warning(f"No session or token found for IP: {self.remote_addr}")
                    return return_response({'error': 'Authentication required'}), 401
                    
                verified_token = verify_jwt(token)
                if isinstance(verified_token, str):
                    return return_response({'error': 'Authentication required'}), 401
                    
                # Set up Flask session
                session['subdomain'] = self.subdomain
                session.permanent = True
                self.data.pop('token', None)
            elif session['subdomain'] != self.subdomain:
                session.clear()
                self.logger.warning(f"Invalid session subdomain, expected {self.subdomain}, got {session['subdomain']}")
                return return_response({'error': 'Authentication required'}), 401

            if request.is_json:
                self.data = request.get_json()
            elif request.form:
                self.data = request.form.to_dict()
            elif request.method == 'GET':
                self.data = request.args.to_dict()
                self.ticket_data = []  # Empty list for GET requests
            else:
                self.data = {}

            # Initialize services
            self.pinecone_service = PineconeService(self.subdomain)
            try:
                self.redis = RedisClient.get_instance()
            except RedisConfigError as e:
                self.logger.error(f"Error connecting to Redis: {e}")
                
            self.cache_ttl = 3600  # 1 hour cache TTL

            self.ticket_data = []
            if 'tickets' in self.data:
                for ticket in self.data['tickets']:
                    self.logger.info(f"Processing ticket: {ticket.get('id')}, request remote addr: {self.remote_addr}")
                    self.ticket_data.append(TicketInput(**ticket))
            else:
                self.logger.warning(f"No tickets found in request, request remote addr: {self.remote_addr}")

            return f(self, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error in init_required: {e}")
            return return_response({'error': 'Internal server error'}), 500
            
    return decorated_function

def process_jwt(token):
    logger.debug(f"JWT found in request {request.url}, remote addr: {request.remote_addr}")
    verified_token = verify_jwt(token)
    if isinstance(verified_token, str):
        logger.error(f"Invalid JWT: {verified_token}, request remote addr: {request.remote_addr}")
        return None, verified_token
        
    # Set up session
    session_token = os.urandom(24).hex()
    session['session_token'] = session_token
    
    return {
        'jwt_token': token,
        'session_token': session_token
    }, None

def session_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'session_token' not in session or session['session_token'] != request.cookies.get('session_token'):
            logger.warning(f"Invalid session attempt from IP: {request.remote_addr}")
            return jsonify({'error': 'Invalid or missing session'}), 401
        return f(*args, **kwargs)
    return decorated_function
