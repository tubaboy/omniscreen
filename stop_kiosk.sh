#!/bin/bash

# =================================================================
# Omniscreen 專業全系統關閉腳本 (v1.0)
# 用於每日定時任務 (16:00) 關閉播放器與監控工具
# =================================================================

KIOSK_PROFILE="/tmp/omniscreen_kiosk"

echo "[$(date +%T)] 正在執行 Omniscreen 系統關閉任務..."

# 1. 關閉監控迴圈腳本本身 (最重要，否則它會不斷重啟瀏覽器)
if pgrep -f "dual_monitor_kiosk.sh" > /dev/null; then
    echo "停止監控腳本 (dual_monitor_kiosk.sh)..."
    pkill -f "dual_monitor_kiosk.sh"
fi

# 2. 透過專屬 Profile 路徑關閉 Chromium 播放器
if pgrep -f "$KIOSK_PROFILE" > /dev/null; then
    echo "關閉 Chromium 播放器視窗..."
    pkill -f "$KIOSK_PROFILE"
fi

# 3. 關閉系統監控工具 btop (含它所屬的終端機)
if pgrep -x "btop" > /dev/null; then
    echo "關閉 btop 監控..."
    pkill -x "btop"
fi

# 4. 可選：清理臨時設定檔，確保明天啟動時是乾淨的狀態
# 如果你想保留瀏覽器的快取 (例如 Service Worker)，可以註解掉下一行
# rm -rf "$KIOSK_PROFILE"

echo "[$(date +%T)] 系統已成功關閉。所有看板進程已終止。"
