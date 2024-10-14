#!/bin/bash

cd frontend && npm run build && cd ..
for i in js css;do
cp frontend/build/static/css/main*.css assets/main.css
done
