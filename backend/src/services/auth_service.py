from functools import wraps
from flask import session, request, jsonify, make_response
import jwt
import os
import logging

logger = logging.getLogger('sentiment_checker')

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

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            token = request.form.get('token')
        except Exception as e:
            logger.error(f"Error getting token: {e}, request remote addr: {request.remote_addr}")
            return jsonify({'error': 'Error getting token'}), 401
        if not token:
            logger.warning(f"Missing token in form, request remote addr: {request.remote_addr}")
            logger.debug(f"Request form: {request.form}")
            return jsonify({'error': 'Missing token'}), 401

        verified_token = verify_jwt(token)
        if isinstance(verified_token, str):
            logger.warning(f"JWT verification failed: {verified_token}, request remote addr: {request.remote_addr}")
            return jsonify({'error': verified_token}), 401

        response = make_response(f(*args, **kwargs))
        response.set_cookie('jwt_token', token, httponly=True, secure=True, samesite='Strict')
        return response
    return decorated_function


def session_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'session_token' not in session or session['session_token'] != request.cookies.get('session_token'):
            logger.warning(f"Invalid session attempt from IP: {request.remote_addr}")
            return jsonify({'error': 'Invalid or missing session'}), 401
        return f(*args, **kwargs)
    return decorated_function
