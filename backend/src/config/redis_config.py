import os
import redis
from typing import Optional
from urllib.parse import urlparse

class RedisConfigError(Exception):
    """Raised when Redis configuration is invalid or missing"""
    pass

class RedisClient:
    _instance: Optional[redis.Redis] = None

    @classmethod
    def get_instance(cls) -> redis.Redis:
        if cls._instance is None:
            # Check for Render Redis URL first
            redis_url = os.getenv('REDIS_URL')
            
            if not redis_url:
                raise RedisConfigError(
                    "REDIS_URL environment variable is not set. "
                    "This is required for production environment."
                )
            
            try:
                parsed_url = urlparse(redis_url)
                if not all([parsed_url.hostname, parsed_url.port]):
                    raise RedisConfigError(
                        "Invalid REDIS_URL format. Must include hostname and port."
                    )
                
                cls._instance = redis.Redis(
                    host=parsed_url.hostname,
                    port=parsed_url.port,
                    ssl=True,
                    decode_responses=True
                )
                # Test the connection
                cls._instance.ping()
                print("Successfully connected to Redis")
                
            except redis.ConnectionError as e:
                raise RedisConfigError(f"Failed to connect to Redis: {str(e)}")
            except Exception as e:
                raise RedisConfigError(f"Unexpected error configuring Redis: {str(e)}")

        return cls._instance

    @classmethod
    def health_check(cls) -> bool:
        try:
            if not cls._instance:
                cls.get_instance()
            cls._instance.ping()
            return True
        except Exception as e:
            print(f"Redis health check failed: {str(e)}")
            return False
