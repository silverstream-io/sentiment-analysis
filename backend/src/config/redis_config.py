import os
import redis
from dotenv import load_dotenv
from typing import Optional
from urllib.parse import urlparse

load_dotenv()

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
            
            if redis_url:
                # Use URL if provided
                try:
                    parsed_url = urlparse(redis_url)
                    if not all([parsed_url.hostname, parsed_url.port]):
                        raise RedisConfigError(
                            "Invalid REDIS_URL format. Must include hostname and port."
                        )
                    
                    cls._instance = redis.Redis(
                        host=parsed_url.hostname,
                        port=parsed_url.port,
                        password=parsed_url.password,
                        ssl=True,
                        decode_responses=True
                    )
                except Exception as e:
                    raise RedisConfigError(f"Failed to parse REDIS_URL: {str(e)}")
            else:
                # Use individual credentials
                host = os.getenv('REDIS_HOST')
                port = os.getenv('REDIS_PORT')
                password = os.getenv('REDIS_PASSWORD')
                ssl = os.getenv('REDIS_SSL', 'false').lower() == 'true'

                if not all([host, port, password]):
                    raise RedisConfigError(
                        "Missing Redis configuration. Required: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD"
                    )

                try:
                    cls._instance = redis.Redis(
                        host=host,
                        port=int(port),
                        password=password,
                        ssl=ssl,
                        decode_responses=True
                    )
                except Exception as e:
                    raise RedisConfigError(f"Failed to connect to Redis: {str(e)}")

            # Test the connection
            try:
                cls._instance.ping()
                print("Successfully connected to Redis")
            except redis.ConnectionError as e:
                raise RedisConfigError(f"Failed to connect to Redis: {str(e)}")

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
