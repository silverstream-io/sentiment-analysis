from api.server import create_app
from dotenv import load_dotenv

load_dotenv("../../.env")

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=8080, debug=True)
