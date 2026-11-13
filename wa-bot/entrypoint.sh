#!/bin/sh
echo "nameserver 8.8.8.8" > /etc/resolv.conf 2>/dev/null || true
echo "nameserver 1.1.1.1" >> /etc/resolv.conf 2>/dev/null || true
exec "$@"
