#!/usr/bin/env bash
# E2E di Linux/X11 (Xvfb). Butuh: xvfb, openbox, wmctrl, xterm, xdotool.
# Menguji aplikasi Electron sungguhan: UI, IPC, agen Code, Control (screenshot/mouse/keyboard/window), izin, audit.
# Gunakan IT7_APP_EXE=/path/ke/binary untuk menguji build terpasang (mis. dist/linux-unpacked/intelligence-7mit-desktop).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -n "${IT7_APP_EXE:-}" ] || npm run build
echo "== Smoke: UI + IPC + agen Code + keamanan =="
xvfb-run -a -s "-screen 0 1600x1000x24" node e2e/smoke.mjs
echo "== Control nyata: screenshot, klik, ketik, window manager =="
xvfb-run -a -s "-screen 0 1280x800x24" sh -c 'openbox >/dev/null 2>&1 & sleep 1; node e2e/control.mjs'
