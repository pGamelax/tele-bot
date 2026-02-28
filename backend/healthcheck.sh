#!/bin/sh
# Healthcheck script que usa a porta do ambiente
port=${PORT:-3000}
bun -e "fetch('http://localhost:' + '$port').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
