#!/bin/bash
set -e

APP_DIR="$HOME/domains/cookbook.com.pl/public_nodejs"

echo "🚀 Deploying Cookbook..."

cd "$APP_DIR"

echo "📥 Pobieranie zmian z GitHub..."
git pull origin master

echo "📦 Instalowanie pakietów..."
npm install --omit=dev --ignore-scripts

echo "🔄 Restart aplikacji..."
touch tmp/restart.txt

echo "✅ Deploy zakończony! Odśwież cookbook.com.pl"
