from api.server import app

if __name__ == '__main__':
    app.template_folder = 'src/templates'
    app.run(host='0.0.0.0', port=4000, debug=True)