#!/bin/bash

# =================================================================
# Omniscreen 啟動腳本 (v1.3) - 增加螢幕自動校正功能
# =================================================================

export DISPLAY=:0
export XAUTHORITY=$HOME/.Xauthority

# --- 模式切換設定 ---
MODE="SINGLE"

# --- 基礎設定 ---
PRIMARY_WIDTH=1920
MONITOR_NAME="DisplayPort-0"         # 延伸螢幕名稱
PLAYER_URL="http://linux-mint.local:3000/player?id=cmo06nxhe0000qj0i0b06nh9w"
BROWSER_CMD="chromium"
KIOSK_PROFILE="/tmp/omniscreen_kiosk"

echo "[$(date +%T)] 正在以 $MODE 模式啟動系統..."

# 1. 隱藏滑鼠游標
if ! pgrep -x "unclutter" > /dev/null; then
    unclutter -idle 5 -root &
fi

# 2. 螢幕佈局校正 (僅在 DUAL 模式執行)
if [ "$MODE" = "DUAL" ]; then
    echo "執行螢幕佈局校正: $MONITOR_NAME 置於主螢幕右側..."
    # 強制設定延伸螢幕位置，確保座標 1920,0 絕對正確
    xrandr --output "$MONITOR_NAME" --auto --right-of "$(xrandr | grep " connected primary" | cut -d' ' -f1)" || \
    xrandr --output "$MONITOR_NAME" --auto --right-of "eDP-1" # 如果找不到 primary，嘗試常見的內建螢幕名
    
    WINDOW_POS="$PRIMARY_WIDTH,0"
else
    WINDOW_POS="0,0"
fi

# 3. 確保音訊開啟 (解除靜音並設為 100%)
pactl set-sink-mute @DEFAULT_SINK@ false 2>/dev/null
pactl set-sink-volume @DEFAULT_SINK@ 100% 2>/dev/null
amixer sset 'Master' unmute 100% 2>/dev/null

# 4. 啟動 Chromium
pkill -f "$KIOSK_PROFILE"
sleep 1

$BROWSER_CMD --new-window \
  --window-position=$WINDOW_POS \
  --user-data-dir="$KIOSK_PROFILE" \
  --incognito \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  --disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,UseSkiaRenderer \
  --disable-audio-output-resampler \
  --check-for-update-interval=31536000 \
  --ignore-gpu-blocklist \
  --enable-gpu-rasterization \
  --force-gpu-rasterization \
  --enable-zero-copy \
  --enable-accelerated-video-decode \
  --disable-dev-shm-usage \
  --gpu-no-context-lost \
  --disable-features=UseSkiaRenderer \
  --enable-native-gpu-memory-buffers \
  --enable-gpu-memory-buffer-video-frames \
  --disk-cache-size=1 \
  --media-cache-size=1 \
  --disable-background-timer-throttling \
  --disable-renderer-backgrounding \
  --use-gl=egl \
  "$PLAYER_URL" &

echo "[$(date +%T)] 啟動完成。"
