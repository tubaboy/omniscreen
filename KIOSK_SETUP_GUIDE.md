# 📺 實體螢幕播放器設定指南 (Kiosk Mode)

當你的伺服器 (Server) 與螢幕播放器 (Player) 是同一台機器時，你通常希望它能「**開機自動全螢幕顯示播放器**」。這就是所謂的 **Kiosk Mode**。

本指南提供 Windows 與 Linux 系統的實作方式。

---

## 🏗️ 播放路徑設定
Omniscreen 的播放器網址預設為：
- **本地播放**: `http://localhost:3000/player`
- **正式環境**: `http://你的IP:3000/player`

---

## 🪟 Windows 系統 (最推薦使用 Edge 或 Chrome)

Windows 的優點是設定簡單，適合使用內建的 Edge 瀏覽器。

### 1. 建立啟動腳本
在桌面點擊右鍵 -> `新增` -> `文字文件`，重新命名為 `start_omniscreen_player.bat` (注意副檔名要是 `.bat`)。

編輯該檔案，貼入以下內容：
```batch
@echo off
:: 等待 Docker 服務啟動 (延遲 30 秒)
timeout /t 30 /nobreak

:: 啟動 Edge (Kiosk 模式 + 強制自動播放聲音)
start msedge --kiosk "http://localhost:3000/player" --edge-kiosk-type=fullscreen --no-first-run --autoplay-policy=no-user-gesture-required

:: 如果你要用 Chrome，請改用下面這行：
:: start chrome --kiosk "http://localhost:3000/player" --no-first-run --no-default-browser-check --autoplay-policy=no-user-gesture-required
```

### 2. 設定開機啟動
1. 按下 `Win + R`，輸入 `shell:startup`。
2. 將剛才建好的 `start_omniscreen_player.bat` **捷徑** 或 **檔案** 直接拖進這個資料夾。
3. 這樣以後電腦重開機，等 Docker 跑好後就會自動全螢幕顯示播放器。

---

## 🐧 Linux 系統 (推薦 Ubuntu / Raspberry Pi)

在 Linux 上，通常使用 Chromium 並搭配簡單的桌面環境設定。

### 1. 安裝 Chromium
```bash
sudo apt update
sudo apt install chromium-browser -y
```

### 2. 建立播放腳本
建立一個 `start_player.sh`:
```bash
#!/bin/bash
# 啟動 unclutter 隱藏滑鼠游標 (5秒不動即隱藏)
unclutter -idle 5 -root &

# 啟動 Chromium 在 Kiosk 模式 (強烈建議加入 --incognito 避開 Service Worker 緩存問題)
chromium-browser --incognito --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required "http://localhost:3000/player"
```

### 3. 設定自動啟動 (LXDE / Pi)
編輯 `/etc/xdg/lxsession/LXDE-pi/autostart` (或對應的啟動檔)，加入：
```bash
@/home/pi/start_player.sh
```

---

## 💡 小技巧
1. **隱藏滑鼠**: 在 Kiosk 模式下滑鼠游標很礙眼，Windows 可以下載 `CursorHider` 或 Linux 使用 `unclutter`。
2. **自動連線**: 確保電腦網路設定為自動連線，否則瀏覽器會顯示斷線頁面。
3. **播放器 ID**: 如果你有特定要顯示的播放器，網址可改為 `http://localhost:3000/player?id=你的播放器ID`。
4. **聲音自動播放**: 以上腳本已包含 `--autoplay-policy=no-user-gesture-required` 參數。若仍無聲音，請確認作業系統層級（Windows 混音器）是否已開啟音量。

---

## 🖥️ 專業雙螢幕監控模式 (iMac/舊電腦轉生)

如果你打算用一台舊電腦（如 iMac A1311）同時當作 **伺服器管理端** 與 **播放端**，你可以利用雙螢幕配置達成「本機螢幕監控系統、外接螢幕全螢幕播放」。

### 1. 顯示器配置 (以 Linux Mint 為例)
1. 進入 **Display Settings**。
2. 將外接螢幕 (Mini DP to HDMI) 設為 **「擴展桌面」(Extended Desktop)**。
3. 確認主螢幕 (iMac) 在左，外接螢幕在右。
4. **重要**: 記住主螢幕的解析度（例如 1920x1080），這決定了外接螢幕的啟動座標。

### 3. 主螢幕管理功能
現在主螢幕將維持空白桌面，你可以直接開啟 **Firefox** 或其他瀏覽器登入 `http://localhost:3000`。
這讓你可以在不影響外接大螢幕播放的情況下，隨時調整排程、素材或監控系統狀態。

### 3. 使用自動偵測腳本 (`dual_monitor_kiosk.sh`)
我們準備了一個比普通啟動更強大的腳本，能解決「每天營業拔插 HDMI 導致視窗位移」的問題。

該腳本邏輯：
- **每 10 秒檢查一次** HDMI 是否連接。
- **偵測到插回**: 自動在第二螢幕啟動全螢幕播放器。
- **偵測到拔除**: 自動關閉原本跳回主螢幕的播放視窗，維持主螢幕管理界面的整潔。

#### 設定步驟：
1.  **下載/尋找專案中的腳本**: [dual_monitor_kiosk.sh](./dual_monitor_kiosk.sh)
2.  **給予執行權限**:
    ```bash
    chmod +x dual_monitor_kiosk.sh
    ```
3.  **確認你的設備名稱**:
    在終端機輸入 `xrandr`，看你的 HDMI 名稱是什麼 (例如 `HDMI-1`)。如果不是 `HDMI-1`，請編輯該腳本最上方的 `MONITOR_NAME` 變數。
4.  **設定為開機啟動**:
    在 Linux Mint 的 **Startup Applications** 中，新增一個設定，路徑指向此 `.sh` 檔案。

> [!TIP]
> 預設座標是以 iMac 21.5 吋的 `1920` 為起點。如果你使用 27 吋的 iMac (A1312)，請將腳本內的 `PRIMARY_WIDTH` 改為 `2560`。


