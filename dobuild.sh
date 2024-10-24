#!/bin/bash

cd frontend && npm run build && cd ..
cp frontend/build/static/js/main.*.js backend/src/static/js/sentimentChecker.js
cp frontend/build/static/css/main.*.css backend/src/static/css/main.css