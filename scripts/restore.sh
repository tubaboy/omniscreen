#!/bin/bash

# OmniScreen Restore Script
# 從備份還原資料庫與素材檔案

if [ -z "$1" ]; then
    echo "請提供備份目錄路徑"
    echo "用法: ./restore.sh /home/$USER/omniscreen_backups/20260415_120000"
    exit 1
fi

BACKUP_PATH="$1"
DB_DUMP="$BACKUP_PATH/db_dump.sql"
MEDIA_TAR="$BACKUP_PATH/media_assets.tar.gz"

DB_CONTAINER="omniscreen-db"
MINIO_CONTAINER="omniscreen-storage"

echo "--- 開始執行 OmniScreen 還原任務 ---"
echo "來源: $BACKUP_PATH"

# 1. 檢查檔案
if [ ! -f "$DB_DUMP" ] || [ ! -f "$MEDIA_TAR" ]; then
    echo "✗ 找不到備份檔案，請檢查路徑是否有誤"
    exit 1
fi

read -p "危險操作：這會覆蓋目前的資料！確定要繼續嗎？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消還原"
    exit 1
fi

# 2. 還原資料庫
echo "[1/2] 正在還原資料庫..."
cat "$DB_DUMP" | docker exec -i $DB_CONTAINER psql -U omniscreen omniscreen

if [ $? -eq 0 ]; then
    echo "✓ 資料庫還原成功"
else
    echo "✗ 資料庫還原失敗"
    exit 1
fi

# 3. 還原素材檔案
echo "[2/2] 正在還原素材檔案..."
# 先清理現有的 data 卷 (謹慎操作)
docker run --rm \
  --volumes-from $MINIO_CONTAINER \
  alpine sh -c "rm -rf /data/*"

# 解壓備份檔案到卷
docker run --rm \
  --volumes-from $MINIO_CONTAINER \
  -v "$BACKUP_PATH":/backup \
  alpine sh -c "cd / && tar xzf /backup/media_assets.tar.gz"

if [ $? -eq 0 ]; then
    echo "✓ 素材檔案還原成功"
else
    echo "✗ 素材檔案還原失敗"
    exit 1
fi

echo "--- 還原完成！請重啟服務以確保一切同步 ---"
echo "建議執行: docker compose restart"
