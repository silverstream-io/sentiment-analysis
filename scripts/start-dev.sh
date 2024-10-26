#!/bin/bash
export SENTIMENT_CHECKER_DEBUG=true

# Start the React development server
cd frontend && npm start &

# Start the Flask backend
cd ../backend && python src/app.py

# Wait for all background processes
wait
