#!/bin/bash
set -e

# Start virtual framebuffer
Xvfb :99 -screen 0 1920x1080x24 &
sleep 1

# Start VNC server
x11vnc -display :99 -forever -shared -rfbport 5900 &

# Start noVNC web interface
websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

# Start Chromium with remote debugging
exec chromium \
    --no-sandbox \
    --disable-gpu \
    --disable-dev-shm-usage \
    --remote-debugging-port=9222 \
    --remote-debugging-address=0.0.0.0 \
    --user-data-dir=/home/browser/.config/chromium \
    --disable-background-networking \
    --disable-default-apps \
    --disable-extensions \
    --disable-sync \
    --disable-translate \
    --headless=new \
    --no-first-run \
    "$@"
