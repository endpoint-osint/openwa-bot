#!/bin/sh
# start.sh — Inicia o servidor OpenWA + bot em paralelo
set -e

# Aguardar servidor ficar pronto
echo "Iniciando OpenWA server..."
node dist/main.js &
SERVER_PID=$!

# Aguardar servidor estar pronto
echo "Aguardando servidor ficar pronto..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:2785/api/health > /dev/null 2>&1; then
    echo "Servidor pronto!"
    break
  fi
  sleep 1
done

# Iniciar bot
echo "Iniciando bot..."
node bot.cjs &
BOT_PID=$!

echo "Servidor (PID $SERVER_PID) e Bot (PID $BOT_PID) rodando."

# Manter rodando
wait $SERVER_PID
