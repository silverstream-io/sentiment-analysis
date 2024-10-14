#!/bin/bash

cd frontend && npm run build && cd ..
for i in js css;do
cp frontend/build/static/$i/main.*.$i app/assets/main.$i
done
