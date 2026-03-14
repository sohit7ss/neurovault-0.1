#!/bin/bash
# Backup script for database and vector indexes
# Run daily via cron: 0 2 * * * /path/to/backup.sh

BACKUP_DIR="./backups/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

echo "=== Starting Backup $(date) ==="

# Database backup
if [ -f "backend/instance/app.db" ]; then
    cp backend/instance/app.db "$BACKUP_DIR/app_db_$(date +%H%M%S).db"
    echo "✓ Database backed up"
fi

# Vector index backup
if [ -d "backend/vector_store" ]; then
    cp -r backend/vector_store "$BACKUP_DIR/vector_store"
    echo "✓ Vector store backed up"
fi

# Uploaded documents backup
if [ -d "backend/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads.tar.gz" backend/uploads/
    echo "✓ Uploads backed up"
fi

# Cleanup old backups (keep 30 days)
find ./backups -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "=== Backup Complete ==="
