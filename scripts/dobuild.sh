#!/bin/bash

# Exit on any error
set -e

echo "Building React frontend..."
cd frontend
npm run build

echo "Creating static directories..."
mkdir -p ../backend/src/static/js/
mkdir -p ../backend/src/static/css/

echo "Copying built files..."
# Copy JS files
cp build/static/js/main.js ../backend/src/static/js/sentimentChecker.js
cp build/static/js/vendors.js ../backend/src/static/js/vendors.js
cp build/static/js/runtime.js ../backend/src/static/js/runtime.js

# Copy any CSS files if they exist
if [ -d "build/static/css" ]; then
    cp build/static/css/* ../backend/src/static/css/
fi

# Copy any license files if they exist
if [ -f "build/static/js/vendors.js.LICENSE.txt" ]; then
    cp build/static/js/vendors.js.LICENSE.txt ../backend/src/static/js/
fi

echo "Build complete!"
