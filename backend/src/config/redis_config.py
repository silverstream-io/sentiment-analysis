import os
import redis
from typing import Optional
from urllib.parse import urlparse

class RedisClient:
    _instance: Optional[redis.Redis] = None

    @classmethod
    def get_instance(cls) -> redis.Redis:
        if cls._instance is None:
            # Check for Render Redis URL first
            redis_url = os.getenv('REDIS_URL')
            
            if redis_url.startswith('redis://'):
                # Parse Render Redis URL
                parsed_url = urlparse(redis_url)
                cls._instance = redis.Redis(
                    host=parsed_url.hostname,
                    port=parsed_url.port,
                    ssl=True,
                    decode_responses=True
                )
                # Test the connection
                try:
                    cls._instance.ping()
                    print("Successfully connected to Render Redis")
                except Exception as e:
                    print(f"Failed to connect to Render Redis: {str(e)}")
                    cls._instance = None
            
            # Fallback to local Redis if Render connection fails
            if cls._instance is None:
                cls._instance = redis.Redis(
                    host='localhost',
                    port=6379,
                    decode_responses=True
                )
                print("Using local Redis instance")

        return cls._instance

    @classmethod
    def health_check(cls) -> bool:
        try:
            cls.get_instance().ping()
            return True
        except Exception as e:
            print(f"Redis health check failed: {str(e)}")
            return False
