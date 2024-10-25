#!/bin/bash
export SENTIMENT_CHECKER_DEBUG=true

# Start the React development server
cd frontend && npm start &

# Start localtunnel and capture the URL
cd frontend && lt --port 3000 > tunnel.log 2>&1 &

# Wait for tunnel URL to be available
while ! grep -q "your url is:" tunnel.log; do
    sleep 1
done
export TUNNEL_URL=$(grep "your url is:" tunnel.log | awk '{print $4}')
echo "Tunnel URL: $TUNNEL_URL"

# Start the Flask backend
cd ../backend && TUNNEL_URL=$TUNNEL_URL python src/app.py

# Wait for all background processes
wait
