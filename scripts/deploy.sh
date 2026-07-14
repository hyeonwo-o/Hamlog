#!/bin/bash

# Load environment variables from .env if present
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

export NODE_ENV=production

if [ -z "${JWT_SECRET:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "❌ JWT_SECRET and ADMIN_PASSWORD are required for production deployment."
  exit 1
fi

echo "🚀 Starting Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest changes from git..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm ci

# 3. Build project
echo "🏗️ Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    # Optional: Notify failure
    node scripts/notify-telegram.js "❌ Deployment Failed: Build Error"
    exit 1
fi

# 4. Restart Server
echo "🔄 Restarting server..."
# Check if pm2 is installed and running
if command -v pm2 &> /dev/null; then
    pm2 restart hamlog --update-env
else
    echo "⚠️ PM2 not found, skipping restart (Manual restart required if running directly)"
fi

echo "✅ Deployment Finished!"

# 5. Send Notification
echo "📢 Sending Telegram Notification..."
node scripts/notify-telegram.js "✅ *Deployment Successful!*
New version is live on HamLog. 🚀"
