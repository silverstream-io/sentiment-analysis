from api.server import create_app
from werkzeug.routing import BaseConverter

class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]

if __name__ == '__main__':
    app = create_app(RegexConverter)
    app.run(host='0.0.0.0', port=4000, debug=True)