from flask import Flask
from flask_cors import CORS
import dotenv
from utils import setup_logging

dotenv.load_dotenv()
logger = setup_logging()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

if __name__ == '__main__':
    app.run(debug=True)
