#!/bin/sh
# Configurar DNS limpio para Docker (127.0.0.11) y DNS público (8.8.8.8 / 1.1.1.1)
# sin opciones de edns0/trust-ad que cuelgan libc getaddrinfo en Node.js
printf "nameserver 127.0.0.11\nnameserver 8.8.8.8\nnameserver 1.1.1.1\n" > /etc/resolv.conf 2>/dev/null || true
exec "$@"

