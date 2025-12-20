import { getRoleIds, getRoleNames } from '../utils/config.js';

/**
 * Tier categories dengan durasi stay
 */
export const TIER_CATEGORIES = {
    free: {
        name: '🆓 Free User',
        stay_duration_hours: 12,
        description: 'Default tier untuk semua user',
        requirement: 'Semua user otomatis dapat tier ini'
    },
    booster: {
        name: '🚀 Server Booster',
        stay_duration_hours: 36,
        description: 'Untuk user yang boost server',
        requirement: 'Boost server Discord kamu'
    },
    donatur: {
        name: '💝 Donatur',
        stay_duration_hours: 48,
        description: 'Untuk user dengan role Donatur',
        requirement: 'Memiliki role Donatur'
    },
    loyalist: {
        name: '👑 Server Loyalist',
        stay_duration_hours: 24,
        description: 'Untuk user dengan role Server Loyalist',
        requirement: 'Memiliki role Server Loyalist'
    }
};

/**
 * Get user tier berdasarkan role dan server boost
 * Priority: Booster > Donatur > Loyalist > Free
 */
export function getUserTier(member) {
    // Check server boost (highest priority)
    if (member.premiumSince) {
        return 'booster';
    }

    const roleIds = getRoleIds();
    const roleNames = getRoleNames();

    // Check Donatur role (by ID first, then by name)
    if (roleIds.donatur && roleIds.donatur.length > 0) {
        const hasDonaturRole = member.roles.cache.some(role => 
            roleIds.donatur.includes(role.id)
        );
        if (hasDonaturRole) {
            return 'donatur';
        }
    }

    if (roleNames.donatur && roleNames.donatur.length > 0) {
        const hasDonaturRole = member.roles.cache.some(role => 
            roleNames.donatur.includes(role.name)
        );
        if (hasDonaturRole) {
            return 'donatur';
        }
    }

    // Check Loyalist role (by ID first, then by name)
    if (roleIds.loyalist && roleIds.loyalist.length > 0) {
        const hasLoyalistRole = member.roles.cache.some(role => 
            roleIds.loyalist.includes(role.id)
        );
        if (hasLoyalistRole) {
            return 'loyalist';
        }
    }

    if (roleNames.loyalist && roleNames.loyalist.length > 0) {
        const hasLoyalistRole = member.roles.cache.some(role => 
            roleNames.loyalist.includes(role.name)
        );
        if (hasLoyalistRole) {
            return 'loyalist';
        }
    }

    // Default: Free
    return 'free';
}

/**
 * Get stay duration hours untuk user
 */
export function getStayDurationHours(member) {
    const tier = getUserTier(member);
    return TIER_CATEGORIES[tier].stay_duration_hours;
}

/**
 * Get tier info
 */
export function getTierInfo(tier) {
    return TIER_CATEGORIES[tier] || TIER_CATEGORIES.free;
}

/**
 * Get user tier info dengan detail
 */
export function getUserTierInfo(member) {
    const tier = getUserTier(member);
    const tierInfo = getTierInfo(tier);
    
    const info = {
        tier,
        tier_name: tierInfo.name,
        stay_duration_hours: tierInfo.stay_duration_hours,
        requirement: tierInfo.requirement
    };

    // Add specific info
    if (tier === 'booster' && member.premiumSince) {
        info.boost_since = member.premiumSince.toISOString();
    } else if (tier === 'donatur') {
        const roleIds = getRoleIds();
        const roleNames = getRoleNames();
        const donaturRole = member.roles.cache.find(role => 
            (roleIds.donatur && roleIds.donatur.includes(role.id)) ||
            (roleNames.donatur && roleNames.donatur.includes(role.name))
        );
        if (donaturRole) {
            info.has_role = donaturRole.name;
        }
    } else if (tier === 'loyalist') {
        const roleIds = getRoleIds();
        const roleNames = getRoleNames();
        const loyalistRole = member.roles.cache.find(role => 
            (roleIds.loyalist && roleIds.loyalist.includes(role.id)) ||
            (roleNames.loyalist && roleNames.loyalist.includes(role.name))
        );
        if (loyalistRole) {
            info.has_role = loyalistRole.name;
        }
    }

    return info;
}

