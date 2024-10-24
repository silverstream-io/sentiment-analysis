#!/bin/bash

cd frontend && npm run build && cd ..
cp frontend/build/sentimentChecker.js backend/src/static/js/sentimentChecker.js
cp frontend/build/background.js backend/src/static/js/background.js
cp frontend/build/topbar.js backend/src/static/js/topbar.js
cp frontend/build/static/css/main.*.css backend/src/static/css/main.css