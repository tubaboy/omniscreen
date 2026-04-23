#!/bin/bash

# =================================================================
# Omniscreen 專業全系統關閉腳本 (v1.1)
# 用於每日定時任務 (16:00) 關閉播放器與監控工具
# =================================================================

KIOSK_PROFILE="/tmp/omniscreen_kiosk"

echo "[$(date +%T)] 正在執行 Omniscreen 系統關閉任務..."

# 1. 關閉啟動/監控腳本本身 (以免它又把瀏覽器開起來)
# 同時搜尋舊版的 dual_monitor_kiosk.sh 與新版的 start_kiosk.sh
for script in "start_kiosk.sh" "dual_monitor_kiosk.sh"; do
    if pgrep -f "$script" > /dev/null; then
        echo "停止啟動腳本 ($script)..."
        pkill -f "$script"
    fi
done

# 2. 透過專屬 Profile 路徑關閉 Chromium 播放器
if pgrep -f "$KIOSK_PROFILE" > /dev/null; then
    echo "關閉 Chromium 播放器視窗..."
    pkill -f "$KIOSK_PROFILE"
fi

# 3. 清理臨時設定檔 (選做)
# 如果你想保留瀏覽器的快取 (例如 Service Worker)，可以註解掉下一行
# rm -rf "$KIOSK_PROFILE"

echo "[$(date +%T)] 系統已成功關閉。所有看板進程已終止。"
