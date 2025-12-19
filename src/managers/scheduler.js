import fs from 'fs';

const SCHEDULES_FILE = 'schedules.json';

/**
 * Scheduler Manager
 */
export class Scheduler {
    constructor() {
        this.schedules = [];
        this.loadSchedules();
    }

    loadSchedules() {
        if (fs.existsSync(SCHEDULES_FILE)) {
            try {
                const data = fs.readFileSync(SCHEDULES_FILE, 'utf8');
                const parsed = JSON.parse(data);
                this.schedules = parsed.schedules || [];
            } catch (error) {
                console.error('⚠️  Error loading schedules:', error);
                this.schedules = [];
            }
        }
    }

    saveSchedules() {
        try {
            fs.writeFileSync(SCHEDULES_FILE, JSON.stringify({ schedules: this.schedules }, null, 2), 'utf8');
        } catch (error) {
            console.error('⚠️  Error saving schedules:', error);
        }
    }

    createSchedule(userId, channelId, scheduledTime, recurring = null) {
        const scheduleId = this.schedules.length + 1;
        
        // Parse scheduled time
        let scheduledDate;
        if (scheduledTime.startsWith('+')) {
            // Relative time
            const parts = scheduledTime.slice(1).split(' ');
            const amount = parseInt(parts[0]);
            const unit = parts[1]?.toLowerCase();
            
            scheduledDate = new Date();
            if (unit?.includes('min')) {
                scheduledDate.setMinutes(scheduledDate.getMinutes() + amount);
            } else if (unit?.includes('hour') || unit?.includes('hr')) {
                scheduledDate.setHours(scheduledDate.getHours() + amount);
            }
        } else {
            // Absolute time (HH:MM)
            const [hour, minute] = scheduledTime.split(':').map(Number);
            scheduledDate = new Date();
            scheduledDate.setHours(hour, minute, 0, 0);
            if (scheduledDate < new Date()) {
                scheduledDate.setDate(scheduledDate.getDate() + 1);
            }
        }

        const schedule = {
            id: scheduleId,
            user_id: userId,
            channel_id: channelId,
            scheduled_time: scheduledDate.toISOString(),
            recurring,
            active: true,
            created_at: new Date().toISOString()
        };

        this.schedules.push(schedule);
        this.saveSchedules();
        return scheduleId;
    }

    getUserSchedules(userId) {
        return this.schedules.filter(s => s.user_id === userId && s.active);
    }

    deleteSchedule(scheduleId, userId) {
        const schedule = this.schedules.find(s => s.id === scheduleId && s.user_id === userId);
        if (schedule) {
            schedule.active = false;
            this.saveSchedules();
            return true;
        }
        return false;
    }

    getActiveSchedules() {
        return this.schedules.filter(s => s.active);
    }
}

export const scheduler = new Scheduler();

