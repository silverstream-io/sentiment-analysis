#!/bin/bash

cd frontend && npm run build && cd ..
cp frontend/build/static/js/main.*.js backend/src/static/js/sentiment-checker.js
cp frontend/build/static/css/main.*.css backend/src/static/css/main.css
