from datetime import datetime
from flask import Request, Response, jsonify, make_response, render_template, request
from functools import wraps
from typing import Optional, Tuple, Dict, Callable, List
from logging.handlers import TimedRotatingFileHandler
import logging
import os

# Set up logging
log_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '../logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.log")
logger = logging.getLogger('sentiment-checker')
logger.setLevel(logging.DEBUG)
file_handler = TimedRotatingFileHandler(log_file, when="midnight", interval=1, backupCount=30)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

def get_subdomain(request: Request) -> Tuple[Optional[str], Optional[Tuple[Dict[str, str], int]]]:
    """
    Get the subdomain from the request headers or query parameters.
    Prioritizes X-Zendesk-Subdomain header, then query parameters, then Origin.
    """
    # First check for X-Zendesk-Subdomain header
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if subdomain:
        logger.info(f"Using subdomain from X-Zendesk-Subdomain header: {subdomain}")
        return subdomain, None
    
    # Then check query parameters
    subdomain = request.args.get('subdomain')
    if subdomain:
        logger.info(f"Using subdomain from query parameters: {subdomain}")
        return subdomain, None
    
    # Finally check origin
    origin = request.args.get('origin') or request.headers.get('Origin')
    if origin:
        try:
            subdomain = origin.split('//')[1].split('.')[0]
            if subdomain != 'api':  # Prevent using 'api' as subdomain
                logger.info(f"Using subdomain from origin: {subdomain}")
                return subdomain, None
        except IndexError:
            logger.warning(f"Invalid origin format: {origin}")
    
    logger.warning(f"Missing valid subdomain in request")
    return None, ({'error': 'Missing valid subdomain'}, 400)

def prune_duplicate_emotions(emotion_results):
    unique_results = {}
    for result in emotion_results:
        text = result['metadata']['text']
        emotions = tuple(sorted([k for k, v in result['metadata'].items() if v and k != 'text']))
        key = (text, emotions)
        
        if key not in unique_results or result['score'] > unique_results[key]['score']:
            unique_results[key] = result
    
    return list(unique_results.values())

def check_element(element, key, type=str) -> Tuple[bool, str]:
    if isinstance(element, dict):
        response = key in element and isinstance(element[key], type)
        element_type = 'dict'
    elif isinstance(element, object):
        response = hasattr(element, key) and isinstance(getattr(element, key), type)
        element_type = 'object'
    else:
        response = False
        element_type = 'unknown'
    return response, element_type

def return_render(template, view_type, subdomain, original_query_string, session_token=None) -> Response:
    if view_type == 'Health':
        subdomain = 'health'
        original_query_string = ''

    try:
        response = make_response(render_template(
            template, 
            view_type=view_type,
            subdomain=subdomain,
            original_query_string=original_query_string
        ))
        logger.debug(f"Template rendered successfully for {view_type}")
            
        if session_token:
            response.set_cookie('session_token', session_token, secure=True, httponly=True, samesite='None')
            logger.debug(f"Cookie set successfully for {view_type}")
            
        return response
    except Exception as e:
        logger.error(f"Error rendering template: {str(e)}")
        raise

def return_response(data, status_code=200) -> Response:
    """Helper method to return response with session data if needed"""
    response = jsonify(data)
    response.status_code = status_code
    return response