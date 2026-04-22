#!/bin/bash

# OmniScreen Backup Script
# 備份資料庫 (PostgreSQL) 與素材檔案 (MinIO)

# 設定環境變數，確保 Cron 找得到指令
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# 設定變數 (改用 $HOME 避免 Cron 環境下 $USER 為空)
BACKUP_DIR="$HOME/omniscreen_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=7

# 容器名稱 (需與 docker-compose.yml 一致)
DB_CONTAINER="omniscreen-db"
MINIO_CONTAINER="omniscreen-storage"

# 建立備份目錄
mkdir -p "$BACKUP_DIR/$TIMESTAMP"

echo "--- 開始執行 OmniScreen 備份 [$TIMESTAMP] ---"

# 1. 備份 PostgreSQL 資料庫
echo "[1/3] 正在導出資料庫..."
docker exec $DB_CONTAINER pg_dump -U omniscreen omniscreen > "$BACKUP_DIR/$TIMESTAMP/db_dump.sql"

if [ $? -eq 0 ]; then
    echo "✓ 資料庫導出成功"
else
    echo "✗ 資料庫導出失敗！"
    exit 1
fi

# 2. 備份 MinIO 素材檔案
echo "[2/3] 正在打包素材檔案..."
# 使用隨機容器掛載磁碟卷進行打包，確保不影響運行
docker run --rm \
  --volumes-from $MINIO_CONTAINER \
  -v "$BACKUP_DIR/$TIMESTAMP":/backup \
  alpine tar czf /backup/media_assets.tar.gz /data

if [ $? -eq 0 ]; then
    echo "✓ 素材檔案打包成功"
else
    echo "✗ 素材檔案打包失敗！"
    exit 1
fi

# 3. 清理舊備份
echo "[3/3] 正在清理 $RETENTION_DAYS 天之前的舊備份..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -name "20*" -exec rm -rf {} +
echo "✓ 舊備份清理完成"

echo "--- 備份任務完成 ---"
echo "備份存放在: $BACKUP_DIR/$TIMESTAMP"
