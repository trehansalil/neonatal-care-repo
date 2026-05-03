#!/bin/bash
cd "$(dirname "$0")/backend"
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
fi
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
