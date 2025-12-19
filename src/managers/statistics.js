import fs from 'fs';

const STATS_FILE = 'statistics.json';

/**
 * Statistics Manager
 */
export class StatisticsManager {
    constructor() {
        this.stats = {
            users: {},
            bots: {},
            channels: {}
        };
        this.loadStats();
    }

    loadStats() {
        if (fs.existsSync(STATS_FILE)) {
            try {
                const data = fs.readFileSync(STATS_FILE, 'utf8');
                this.stats = JSON.parse(data);
            } catch (error) {
                console.error('⚠️  Error loading statistics:', error);
                this.stats = { users: {}, bots: {}, channels: {} };
            }
        }
    }

    saveStats() {
        try {
            fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2), 'utf8');
        } catch (error) {
            console.error('⚠️  Error saving statistics:', error);
        }
    }

    recordCall(userId, botNumber, channelId, tier, durationHours) {
        // User stats
        if (!this.stats.users[userId]) {
            this.stats.users[userId] = {
                total_calls: 0,
                total_hours: 0,
                tier_usage: {},
                last_used: null
            };
        }

        const userStats = this.stats.users[userId];
        userStats.total_calls++;
        userStats.total_hours += durationHours;
        userStats.tier_usage[tier] = (userStats.tier_usage[tier] || 0) + 1;
        userStats.last_used = new Date().toISOString();

        // Bot stats
        if (!this.stats.bots[botNumber]) {
            this.stats.bots[botNumber] = {
                total_calls: 0,
                total_hours: 0
            };
        }

        this.stats.bots[botNumber].total_calls++;
        this.stats.bots[botNumber].total_hours += durationHours;

        // Channel stats
        if (!this.stats.channels[channelId]) {
            this.stats.channels[channelId] = {
                total_calls: 0,
                total_hours: 0
            };
        }

        this.stats.channels[channelId].total_calls++;
        this.stats.channels[channelId].total_hours += durationHours;

        this.saveStats();
    }

    getUserStats(userId) {
        return this.stats.users[userId] || {
            total_calls: 0,
            total_hours: 0,
            tier_usage: {},
            last_used: null
        };
    }

    getLeaderboard(limit = 10) {
        const users = Object.entries(this.stats.users)
            .map(([userId, stats]) => ({
                user_id: userId,
                total_calls: stats.total_calls,
                total_hours: stats.total_hours
            }))
            .sort((a, b) => b.total_calls - a.total_calls)
            .slice(0, limit);

        return users;
    }
}

export const statisticsManager = new StatisticsManager();

