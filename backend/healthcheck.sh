#!/bin/sh
# Healthcheck script que usa a porta do ambiente
port=${PORT:-3000}
# Usar curl se disponível, senão usar bun
if command -v curl >/dev/null 2>&1; then
  curl -f http://localhost:$port/ || exit 1
else
  bun -e "fetch('http://localhost:' + '$port').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
fi
