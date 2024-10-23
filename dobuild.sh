#!/bin/bash

cd frontend && npm run build && cd ..
cp frontend/build/main.js backend/src/static/js/sentiment-checker.js
cp frontend/build/background.js backend/src/static/js/background.js
cp frontend/build/static/css/main.*.css backend/src/static/css/main.css