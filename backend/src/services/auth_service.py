from functools import wraps
from flask import request, jsonify, session, make_response
import jwt
import os
import logging

logger = logging.getLogger(__name__)

def verify_jwt(token):
    logger.debug(f"Verifying JWT: {token[:10]}...")  # Log first 10 characters of token
    if not token:
        logger.error("Missing token")
        return 'Missing token'
    try:
        key = os.environ.get('ZENDESK_APP_PUBLIC_KEY')
        audience = os.environ.get('ZENDESK_APP_AUD')
        logger.error(f"Key: {key[:10]}...")
        logger.error(f"Audience: {audience}")
        if not key or not audience:
            logger.error("Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables")
            return 'Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables'
        algorithms = ['RS256','HS256']
        failed = []
        for algorithm in algorithms:    
            try:
                payload = jwt.decode(token, key, algorithms=[algorithm], audience=audience)
                return payload
            except jwt.InvalidAlgorithmError as e:
                logger.error(f"Invalid algorithm: {str(e)}")
                failed.append(algorithm)
        if failed:
            logger.error(f"Failed to verify JWT with algorithms: {failed}")
            return f'Failed to verify JWT with algorithms: {failed}'
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return 'Token has expired'
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        return f'Invalid token: {str(e)}'

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            token = request.form.get('token')
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            return jsonify({'error': 'Error getting token'}), 401
        if not token:
            logger.error("Missing token in form")
            logger.error(f"Request form: {request.form}")
            return jsonify({'error': 'Missing token'}), 401

        verified_token = verify_jwt(token)
        if isinstance(verified_token, str):
            logger.error(f"JWT verification failed: {verified_token}")
            return jsonify({'error': verified_token}), 401

        response = make_response(f(*args, **kwargs))
        response.set_cookie('jwt_token', token, httponly=True, secure=True, samesite='Strict')
        return response
    return decorated_function
