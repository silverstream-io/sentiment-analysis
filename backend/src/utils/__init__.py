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
logger = logging.getLogger('api.server')
logger.setLevel(logging.DEBUG)
file_handler = TimedRotatingFileHandler(log_file, when="midnight", interval=1, backupCount=30)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

def get_subdomain(request: Request) -> Tuple[Optional[str], Optional[Tuple[Dict[str, str], int]]]:
    """
    Get the subdomain from the request headers. If it's missing, return an error.
    """
    subdomain = request.headers.get('X-Zendesk-Subdomain')
    if not subdomain:
        logger.info("Missing Zendesk subdomain in request headers")
        return None, ({'error': 'Missing Zendesk subdomain'}, 400)
    return subdomain, None