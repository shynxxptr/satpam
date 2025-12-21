import ytdl from '@distube/ytdl-core';
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { YouTube } from 'youtube-sr';
import SpotifyWebApi from 'spotify-web-api-node';
import { getSpotifyCredentials } from '../utils/config.js';

// Global music state
const musicStates = new Map(); // guildId -> { player, connection, queue, nowPlaying, paused }

// Initialize Spotify API if credentials available
let spotifyApi = null;
const spotifyCreds = getSpotifyCredentials();
if (spotifyCreds && spotifyCreds.client_id && spotifyCreds.client_secret) {
    spotifyApi = new SpotifyWebApi({
        clientId: spotifyCreds.client_id,
        clientSecret: spotifyCreds.client_secret
    });
    
    // Get access token
    spotifyApi.clientCredentialsGrant()
        .then(data => {
            spotifyApi.setAccessToken(data.body['access_token']);
            console.log('✅ Spotify API initialized');
        })
        .catch(err => {
            console.error('❌ Spotify API error:', err.message);
            spotifyApi = null;
        });
}

/**
 * Get or create music state for guild
 */
function getMusicState(guildId) {
    if (!musicStates.has(guildId)) {
        musicStates.set(guildId, {
            player: createAudioPlayer(),
            connection: null,
            queue: [],
            nowPlaying: null,
            paused: false,
            volume: 1.0
        });
    }
    return musicStates.get(guildId);
}

/**
 * Search YouTube for query
 */
async function searchYouTube(query) {
    try {
        const results = await YouTube.search(query, { limit: 1, type: 'video' });
        if (results.length === 0) return null;
        
        const video = results[0];
        return {
            url: video.url,
            title: video.title,
            duration: video.durationFormatted,
            thumbnail: video.thumbnail?.url,
            source: 'youtube'
        };
    } catch (error) {
        console.error('YouTube search error:', error);
        return null;
    }
}

/**
 * Get YouTube video info
 */
async function getYouTubeInfo(url) {
    try {
        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-us,en;q=0.5',
                    cookie: process.env.YOUTUBE_COOKIE || ''
                }
            }
        });
        
        return {
            url: url,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            thumbnail: info.videoDetails.thumbnails[0]?.url,
            source: 'youtube'
        };
    } catch (error) {
        console.error('YouTube info error:', error);
        
        // Check if it's a "Sign in" error
        if (error.message && (error.message.includes('Sign in') || error.message.includes('bot'))) {
            throw new Error('YouTube memblokir request. Silakan coba lagi nanti atau gunakan search dengan kata kunci saja (bukan URL langsung).');
        }
        
        throw error;
    }
}

/**
 * Get Spotify track info and convert to YouTube
 */
async function getSpotifyTrack(spotifyUrl) {
    if (!spotifyApi) {
        throw new Error('Spotify API tidak dikonfigurasi');
    }

    try {
        const trackId = extractSpotifyId(spotifyUrl);
        if (!trackId) throw new Error('Invalid Spotify URL');

        const data = await spotifyApi.getTrack(trackId);
        const track = data.body;
        
        // Search YouTube dengan format: "Artist - Title"
        const query = `${track.artists[0].name} - ${track.name}`;
        const youtubeResult = await searchYouTube(query);
        
        if (!youtubeResult) {
            throw new Error('Tidak bisa menemukan lagu di YouTube');
        }

        return {
            ...youtubeResult,
            spotifyTrack: {
                name: track.name,
                artists: track.artists.map(a => a.name),
                album: track.album.name
            },
            source: 'spotify'
        };
    } catch (error) {
        console.error('Spotify error:', error);
        throw error;
    }
}

/**
 * Extract Spotify ID from URL
 */
function extractSpotifyId(url) {
    const patterns = [
        /spotify:track:([a-zA-Z0-9]+)/,
        /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Create audio resource from YouTube URL
 */
function createAudioResourceFromYouTube(url) {
    try {
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-us,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    cookie: process.env.YOUTUBE_COOKIE || ''
                }
            }
        });

        return createAudioResource(stream, {
            inlineVolume: true
        });
    } catch (error) {
        console.error('Audio resource error:', error);
        throw error;
    }
}

/**
 * Play next song in queue
 */
async function playNext(guildId, channel) {
    const state = getMusicState(guildId);
    
    if (state.queue.length === 0) {
        state.nowPlaying = null;
        return;
    }

    const song = state.queue.shift();
    state.nowPlaying = song;
    state.paused = false;

    try {
        // Create audio resource
        const resource = createAudioResourceFromYouTube(song.url);
        resource.volume?.setVolume(state.volume);

        // Play
        state.player.play(resource);

        // Setup connection if needed
        if (!state.connection || state.connection.state.status === VoiceConnectionStatus.Disconnected) {
            state.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            // Wait for connection to be ready
            try {
                await entersState(state.connection, VoiceConnectionStatus.Ready, 5000);
            } catch (error) {
                console.error('Voice connection timeout:', error);
                throw new Error('Tidak bisa connect ke voice channel');
            }

            state.connection.subscribe(state.player);
        }

        // Handle end of song
        state.player.once(AudioPlayerStatus.Idle, () => {
            setTimeout(() => playNext(guildId, channel), 1000);
        });

        return song;
    } catch (error) {
        console.error('Play error:', error);
        state.nowPlaying = null;
        throw error;
    }
}

/**
 * Music Player Manager
 */
export const musicPlayer = {
    /**
     * Play music
     */
    async play(query, channel, member) {
        const guildId = channel.guild.id;
        const state = getMusicState(guildId);

        let song = null;

        try {
            // Check if Spotify URL
            if (query.includes('spotify.com') || query.includes('spotify:')) {
                song = await getSpotifyTrack(query);
            }
            // Check if YouTube URL - Always use search to avoid bot detection
            else if (ytdl.validateURL(query)) {
                // Extract video ID and use search instead of direct URL access
                // This avoids YouTube bot detection
                const videoId = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
                if (videoId) {
                    console.log(`YouTube URL detected, using search for video ID: ${videoId}`);
                    song = await searchYouTube(videoId);
                    if (!song) {
                        // If search fails, try direct URL as last resort
                        try {
                            song = await getYouTubeInfo(query);
                        } catch (error) {
                            throw new Error('Tidak bisa mengakses URL YouTube. Coba gunakan search dengan kata kunci saja.');
                        }
                    }
                } else {
                    // Invalid URL format, try direct access
                    try {
                        song = await getYouTubeInfo(query);
                    } catch (error) {
                        // Fallback to search
                        song = await searchYouTube(query);
                        if (!song) {
                            throw new Error('Tidak bisa mengakses URL YouTube. Coba gunakan search dengan kata kunci saja.');
                        }
                    }
                }
            }
            // Search YouTube
            else {
                song = await searchYouTube(query);
                if (!song) {
                    throw new Error('Tidak bisa menemukan lagu. Coba gunakan kata kunci yang lebih spesifik.');
                }
            }

            // Add to queue
            song.requestedBy = member.id;
            song.requestedByUsername = member.user.tag;
            state.queue.push(song);

            // If nothing playing, start playing
            if (!state.nowPlaying && state.player.state.status === AudioPlayerStatus.Idle) {
                await playNext(guildId, channel);
            }

            return song;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Stop music
     */
    stop(guildId) {
        const state = getMusicState(guildId);
        if (state.player) {
            state.player.stop();
        }
        state.queue = [];
        state.nowPlaying = null;
        state.paused = false;
    },

    /**
     * Pause music
     */
    pause(guildId) {
        const state = getMusicState(guildId);
        if (state.player && state.player.state.status === AudioPlayerStatus.Playing) {
            state.player.pause();
            state.paused = true;
            return true;
        }
        return false;
    },

    /**
     * Resume music
     */
    resume(guildId) {
        const state = getMusicState(guildId);
        if (state.player && state.player.state.status === AudioPlayerStatus.Paused) {
            state.player.unpause();
            state.paused = false;
            return true;
        }
        return false;
    },

    /**
     * Get now playing
     */
    getNowPlaying(guildId) {
        const state = getMusicState(guildId);
        return state.nowPlaying;
    },

    /**
     * Get queue
     */
    getQueue(guildId) {
        const state = getMusicState(guildId);
        return state.queue;
    },

    /**
     * Skip current song
     */
    async skip(guildId, channel) {
        const state = getMusicState(guildId);
        if (state.player) {
            state.player.stop();
            await playNext(guildId, channel);
            return true;
        }
        return false;
    },

    /**
     * Disconnect
     */
    disconnect(guildId) {
        const state = getMusicState(guildId);
        if (state.connection) {
            state.connection.destroy();
            state.connection = null;
        }
        if (state.player) {
            state.player.stop();
        }
        musicStates.delete(guildId);
    },

    /**
     * Check if playing
     */
    isPlaying(guildId) {
        const state = getMusicState(guildId);
        return state.player?.state.status === AudioPlayerStatus.Playing;
    },

    /**
     * Check if paused
     */
    isPaused(guildId) {
        const state = getMusicState(guildId);
        return state.paused;
    }
};

