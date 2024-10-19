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
        # Log the contents of the JWT without verifying
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logger.info(f"JWT contents: {unverified_payload}")

        key = os.environ.get('ZENDESK_APP_PUBLIC_KEY')
        audience = os.environ.get('ZENDESK_APP_AUD')
        logger.debug(f"Public key: {key[:10]}...")  # Log first 10 characters of key
        logger.debug(f"Audience: {audience}")
        if not key or not audience:
            logger.error("Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables")
            return 'Missing ZENDESK_APP_PUBLIC_KEY or ZENDESK_APP_AUD in environment variables'
        payload = jwt.decode(token, key, algorithms=['RS256'], audience=audience)
        logger.info("JWT successfully verified")
        return payload
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return 'Token has expired'
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        return f'Invalid token: {str(e)}'

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.error("Missing Authorization header")
            return jsonify({'error': 'Missing Authorization header'}), 401
        try:    
            token = request.cookies.get('jwt_token') or request.form.get('token')
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            return jsonify({'error': 'Error getting token'}), 401
        if not token:
            logger.error("Missing token in headers")
            return jsonify({'error': 'Missing token'}), 401

        verified_token = verify_jwt(token)
        if isinstance(verified_token, str):
            logger.error(f"JWT verification failed: {verified_token}")
            return jsonify({'error': verified_token}), 401

        response = make_response(f(*args, **kwargs))
        response.set_cookie('jwt_token', token, httponly=True, secure=True, samesite='Strict')
        return response
    return decorated_function
