#!/bin/bash

# =================================================================
# Omniscreen 專業雙螢幕啟動與自動復位腳本 (v1.0)
# 適用於: Linux Mint / Ubuntu / Debian (Chromium-based)
# =================================================================

# --- 設定區 ---
PRIMARY_WIDTH=1920           # iMac 本機螢幕寬度 (決定外接螢幕座標)
PLAYER_URL="http://localhost:3000/player"
CHECK_INTERVAL=10            # 每 10 秒檢查一次 HDMI 狀態
# 請執行 'xrandr' 查詢你的外接螢幕名稱 (通常是 HDMI-1, DP-1 或 VGA-1)
MONITOR_NAME="HDMI-1"

echo "Omniscreen 監控模式已啟動..."
echo "正在監控 $MONITOR_NAME 的連接狀態..."

# 先啟動系統監控工具 (btop) 在本機螢幕
if ! pgrep -x "btop" > /dev/null; then
  gnome-terminal --full-screen -- btop &
fi

# --- 循環檢查邏輯 ---
while true; do
  # 檢查外接螢幕是否已連接
  if xrandr | grep -q "$MONITOR_NAME connected"; then
    
    # 如果螢幕在，但播放器 (Chromium) 沒在跑
    if ! pgrep -f "chromium-browser.*$PLAYER_URL" > /dev/null; then
      echo "[$(date +%T)] 偵測到 $MONITOR_NAME，啟動全螢幕播放器..."
      
      # 啟動命令 (強制定位於 X=$PRIMARY_WIDTH)
      chromium-browser --new-window \
        --window-position=$PRIMARY_WIDTH,0 \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --autoplay-policy=no-user-gesture-required \
        "$PLAYER_URL" &
    fi

  else
    # 如果螢幕拔掉了，但播放器還在跑 (它會出現在主螢幕，很礙事)
    if pgrep -f "chromium-browser.*$PLAYER_URL" > /dev/null; then
      echo "[$(date +%T)] $MONITOR_NAME 已斷開，關閉播放器視窗..."
      pkill -f "chromium-browser.*$PLAYER_URL"
    fi
  fi

  sleep $CHECK_INTERVAL
done
