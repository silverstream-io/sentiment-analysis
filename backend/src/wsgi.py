import os
import sys

# Add the current directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.server import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8080)
