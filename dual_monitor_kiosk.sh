#!/bin/bash

# =================================================================
# Omniscreen 專業雙螢幕啟動與自動復位腳本 (v1.1)
# 修正：支援 Linux Mint (chromium) 並解決重複啟動 Bug
# =================================================================

# --- 設定區 ---
PRIMARY_WIDTH=1920            # iMac 本機螢幕寬度 (決定外接螢幕座標)
PLAYER_URL="http://linux-mint.local:3000/player?id=cmo06nxhe0000qj0i0b06nh9w"
CHECK_INTERVAL=5              # 縮短檢查時間，反應更快
MONITOR_NAME="DisplayPort-0"         # 請確保 xrandr 輸出包含此名稱
BROWSER_CMD="chromium"        # Linux Mint 使用 chromium
KIOSK_PROFILE="/tmp/omniscreen_kiosk" # 獨立的瀏覽器設定檔，方便識別進程

echo "Omniscreen 監控模式已啟動..."
echo "正在監控 $MONITOR_NAME 的連接狀態..."

# --- 環境檢查 ---
# 檢查必要工具是否安裝
for cmd in xrandr unclutter gnome-terminal btop chromium; do
  if ! command -v $cmd &> /dev/null; then
    echo "[警告] 缺少工具: $cmd，請執行 'sudo apt update && sudo apt install $cmd' 安裝"
  fi
done

# 啟動 unclutter 隱藏滑鼠游標 (5秒不動即隱藏)
if ! pgrep -x "unclutter" > /dev/null; then
  unclutter -idle 5 -root &
  echo "[OK] 已啟動 unclutter 隱藏滑鼠..."
fi

# --- 循環檢查邏輯 ---
while true; do
  # 檢查外接螢幕是否已連接
  if xrandr | grep -q "$MONITOR_NAME connected"; then
    
    # 檢查是否已有專屬的播放器進程在執行
    # 使用 --user-data-dir 的路徑來精確比對，避免與一般視窗混淆
    if ! pgrep -f "$KIOSK_PROFILE" > /dev/null; then
      echo "[$(date +%T)] 偵測到 $MONITOR_NAME，正在啟動播放器..."
      
      # 確保系統音量開啟
      pactl set-sink-mute @DEFAULT_SINK@ false 2>/dev/null
      pactl set-sink-volume @DEFAULT_SINK@ 100% 2>/dev/null
      amixer sset 'Master' unmute 100% 2>/dev/null

      # 啟動命令 (加入 --incognito 以避免 Service Worker 緩存過期問題)
      $BROWSER_CMD --new-window \
        --window-position=$PRIMARY_WIDTH,0 \
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
        
      # 給瀏覽器一點時間啟動，避免進程清單尚未更新
      sleep 2
    fi

  else
    # 如果螢幕拔掉了，但播放器還在跑，就關閉它
    if pgrep -f "$KIOSK_PROFILE" > /dev/null; then
      echo "[$(date +%T)] $MONITOR_NAME 已斷開，關閉播放器視窗..."
      pkill -f "$KIOSK_PROFILE"
    fi
  fi

  sleep $CHECK_INTERVAL
done
