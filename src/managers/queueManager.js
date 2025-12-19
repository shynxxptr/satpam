import fs from 'fs';

const QUEUE_FILE = 'queue.json';
const QUEUE_TIMEOUT_MINUTES = 5;

/**
 * Queue Manager
 */
export class QueueManager {
    constructor() {
        this.queue = [];
        this.loadQueue();
    }

    loadQueue() {
        if (fs.existsSync(QUEUE_FILE)) {
            try {
                const data = fs.readFileSync(QUEUE_FILE, 'utf8');
                const parsed = JSON.parse(data);
                this.queue = parsed.queue || [];
            } catch (error) {
                console.error('⚠️  Error loading queue:', error);
                this.queue = [];
            }
        }
    }

    saveQueue() {
        try {
            fs.writeFileSync(QUEUE_FILE, JSON.stringify({ queue: this.queue }, null, 2), 'utf8');
        } catch (error) {
            console.error('⚠️  Error saving queue:', error);
        }
    }

    addToQueue(userId, channelId, tier) {
        // Remove user if already in queue
        this.removeFromQueue(userId);

        const position = this.queue.length + 1;
        const entry = {
            user_id: userId,
            channel_id: channelId,
            tier,
            position,
            joined_at: new Date().toISOString()
        };

        this.queue.push(entry);
        this.updatePositions();
        this.saveQueue();
        return position;
    }

    removeFromQueue(userId) {
        const initialLen = this.queue.length;
        this.queue = this.queue.filter(q => q.user_id !== userId);
        
        if (this.queue.length !== initialLen) {
            this.updatePositions();
            this.saveQueue();
            return true;
        }
        return false;
    }

    updatePositions() {
        this.queue.forEach((entry, index) => {
            entry.position = index + 1;
        });
    }

    getNextInQueue() {
        this.cleanExpired();
        return this.queue.length > 0 ? this.queue[0] : null;
    }

    cleanExpired() {
        const now = new Date();
        const expired = this.queue.filter(entry => {
            const joinedAt = new Date(entry.joined_at);
            return (now - joinedAt) > (QUEUE_TIMEOUT_MINUTES * 60 * 1000);
        });

        expired.forEach(entry => this.removeFromQueue(entry.user_id));
    }

    getQueuePosition(userId) {
        const entry = this.queue.find(q => q.user_id === userId);
        return entry ? entry.position : null;
    }

    getQueueInfo(userId) {
        const position = this.getQueuePosition(userId);
        if (position === null) return null;

        const entry = this.queue.find(q => q.user_id === userId);
        const estimatedMinutes = (position - 1) * 15;

        return {
            position,
            total_in_queue: this.queue.length,
            estimated_minutes: estimatedMinutes,
            joined_at: entry.joined_at
        };
    }

    getQueueList() {
        this.cleanExpired();
        return [...this.queue];
    }
}

export const queueManager = new QueueManager();

