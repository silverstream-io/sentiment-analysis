#!/bin/bash

# Exit on any error
set -e

echo "Building React frontend..."
cd frontend
npm run build

sleep 5
if [[ ! -d ../backend/src/static/js/ ]];then
  echo "Creating static directories..."
  mkdir -p ../backend/src/static/js/
  mkdir -p ../backend/src/static/css/
fi

echo "Copying built files..."
for i in $(ls build/static/js/main.*.js); do
  cp $i ../backend/src/static/js/sentimentChecker.js 
done

# Copy any CSS files if they exist
if [ -d "build/static/css" ]; then
    cp build/static/css/* ../backend/src/static/css/
fi

echo "Build complete!"
