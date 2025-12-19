import fs from 'fs';
import path from 'path';

const BACKUP_DIR = 'backups';
const BACKUP_RETENTION = 10;

/**
 * Backup Manager
 */
export class BackupManager {
    constructor() {
        this.backupDir = BACKUP_DIR;
        this.ensureBackupDir();
    }

    ensureBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    createBackup(data) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const backupId = `backup_${timestamp}`;
        const backupFile = path.join(this.backupDir, `${backupId}.json`);

        const backupData = {
            backup_id: backupId,
            timestamp: new Date().toISOString(),
            data
        };

        try {
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
            this.cleanOldBackups();
            return backupId;
        } catch (error) {
            console.error('⚠️  Error creating backup:', error);
            return null;
        }
    }

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    mtime: fs.statSync(path.join(this.backupDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length > BACKUP_RETENTION) {
                files.slice(BACKUP_RETENTION).forEach(file => {
                    fs.unlinkSync(file.path);
                });
            }
        } catch (error) {
            console.error('⚠️  Error cleaning old backups:', error);
        }
    }

    getLatestBackup() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    mtime: fs.statSync(path.join(this.backupDir, f)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime);

            if (files.length === 0) return null;

            const data = fs.readFileSync(files[0].path, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('⚠️  Error loading latest backup:', error);
            return null;
        }
    }

    restoreBackup(backupId = null) {
        if (backupId) {
            const backupFile = path.join(this.backupDir, `${backupId}.json`);
            if (!fs.existsSync(backupFile)) return null;

            try {
                const data = fs.readFileSync(backupFile, 'utf8');
                const backup = JSON.parse(data);
                return backup.data;
            } catch (error) {
                console.error('⚠️  Error restoring backup:', error);
                return null;
            }
        } else {
            const backup = this.getLatestBackup();
            return backup ? backup.data : null;
        }
    }
}

export const backupManager = new BackupManager();
export const AUTO_BACKUP_INTERVAL = 300000; // 5 minutes in milliseconds

