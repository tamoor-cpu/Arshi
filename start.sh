#!/bin/bash
# WashOps - Start Script
# Run this from the washops/ directory: ./start.sh

set -e

echo "🚗 WashOps Startup"
echo "==================="

# Check if we're in the right directory
if [ ! -d "server" ] || [ ! -d "client" ]; then
  echo "❌ Please run this script from the washops/ directory"
  exit 1
fi

# ---- SERVER SETUP ----
echo ""
echo "📦 Setting up server..."
cd server

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "   Installing server dependencies..."
  npm install
fi

# Generate Prisma client
echo "   Generating Prisma client..."
npx prisma generate 2>/dev/null

# Run migrations
echo "   Running database migrations..."
npx prisma migrate dev --name init 2>/dev/null || true

# Seed if DB is empty
USER_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });
" 2>/dev/null)

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "   Seeding database with demo data..."
  node prisma/seed.js
fi

# Kill any existing server on port 4000
lsof -ti:4000 | xargs kill -9 2>/dev/null || true

echo "   Starting API server on port 4000..."
node src/index.js &
SERVER_PID=$!
sleep 2

# Verify server is up
HEALTH=$(curl -s http://localhost:4000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "   ✅ API server running! $(echo $HEALTH | grep -o '"users":[0-9]*')"
else
  echo "   ⚠️  API server started but health check returned: $HEALTH"
fi

# ---- CLIENT SETUP ----
echo ""
echo "📦 Setting up client..."
cd ../client

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "   Installing client dependencies..."
  npm install
fi

# Kill any existing dev server on port 3002
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

echo "   Starting React app on port 3002..."
PORT=3002 BROWSER=none npm start &
CLIENT_PID=$!

# Wait for React to compile
echo "   Waiting for React to compile..."
for i in $(seq 1 60); do
  if curl -s http://localhost:3002 > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "==========================================="
echo "🚗 WashOps is running!"
echo "==========================================="
echo ""
echo "   Frontend:  http://localhost:3002"
echo "   API:       http://localhost:4000"
echo ""
echo "   Demo Logins:"
echo "   Admin:     admin@splashexpress.com / password123"
echo "   Manager:   manager@splashexpress.com / password123"
echo "   Employee:  carlos@splashexpress.com / password123"
echo ""
echo "   Press Ctrl+C to stop both servers"
echo ""

# Handle Ctrl+C gracefully
trap "echo ''; echo 'Shutting down...'; kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit 0" INT TERM

# Wait for either process to exit
wait
