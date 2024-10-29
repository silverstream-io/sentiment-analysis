from typing import Optional, Tuple, Dict
from flask import Request
import os
from datetime import datetime
import logging
from logging.handlers import TimedRotatingFileHandler

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
