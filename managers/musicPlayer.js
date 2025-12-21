import ytdl from '@distube/ytdl-core';
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { YouTube } from 'youtube-sr';
import SpotifyWebApi from 'spotify-web-api-node';
import { getSpotifyCredentials } from '../utils/config.js';

// Global music state
const musicStates = new Map(); // guildId -> { player, connection, queue, nowPlaying, paused, errorCallbacks }

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
        const player = createAudioPlayer();
        
        // Setup error handler once
        player.on('error', async (error) => {
            console.error('Audio player error:', error.message);
            const state = musicStates.get(guildId);
            if (!state) return;
            
            const currentSong = state.nowPlaying;
            const isParsingError = error.message && error.message.includes('parsing watch.html');
            
            // If YouTube parsing error and we have original query, try Spotify fallback
            if (isParsingError && currentSong && (currentSong.originalQuery || currentSong.title) && spotifyApi && !currentSong.spotifyFallback && state.currentChannel) {
                console.log('YouTube parsing error detected, trying Spotify fallback...');
                
                try {
                    const query = currentSong.originalQuery || currentSong.title;
                    const spotifyResult = await searchSpotifyTracks(query);
                    
                    if (spotifyResult) {
                        console.log(`Spotify fallback success: ${spotifyResult.title}`);
                        
                        // Update song
                        currentSong.url = spotifyResult.url;
                        currentSong.spotifyTrack = spotifyResult.spotifyTrack;
                        currentSong.spotifyFallback = true;
                        currentSong.source = 'spotify';
                        
                        // Retry playback with Spotify result
                        state.nowPlaying = currentSong;
                        
                        try {
                            const resourceResult = await createAudioResourceFromYouTube(spotifyResult.url);
                            if (resourceResult.resource) {
                                const resource = resourceResult.resource;
                                resource.volume?.setVolume(state.volume);
                                state.player.play(resource);
                                
                                // Notify success
                                if (state.errorCallbacks.length > 0) {
                                    state.errorCallbacks.forEach(callback => {
                                        try {
                                            callback(null, currentSong, `✅ Auto-fallback ke Spotify: ${spotifyResult.title}`);
                                        } catch (err) {
                                            console.error('Error in success callback:', err);
                                        }
                                    });
                                }
                                return; // Success, don't continue with error handling
                            }
                        } catch (retryError) {
                            console.error('Spotify fallback retry error:', retryError);
                        }
                    }
                } catch (fallbackError) {
                    console.error('Spotify fallback error:', fallbackError);
                }
            }
            
            // If fallback failed or not applicable, proceed with normal error handling
            state.nowPlaying = null;
            
            // Notify error callbacks
            if (state.errorCallbacks.length > 0) {
                const errorMsg = isParsingError
                    ? 'YouTube memblokir request. Spotify fallback juga gagal. Silakan coba lagi nanti.'
                    : `Error memutar musik: ${error.message}`;
                
                state.errorCallbacks.forEach(callback => {
                    try {
                        callback(errorMsg, currentSong);
                    } catch (err) {
                        console.error('Error in error callback:', err);
                    }
                });
                // Clear callbacks after notifying
                state.errorCallbacks = [];
            }
            
            // If it's a YouTube parsing error, log it
            if (isParsingError) {
                console.log('YouTube parsing error detected. Spotify fallback attempted but failed or not available.');
            }
        });
        
        musicStates.set(guildId, {
            player: player,
            connection: null,
            queue: [],
            nowPlaying: null,
            paused: false,
            volume: 1.0,
            errorCallbacks: [],
            currentChannel: null // Store channel for error retry // Callbacks untuk notify user tentang errors
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
 * Search Spotify tracks by query
 */
async function searchSpotifyTracks(query) {
    if (!spotifyApi) {
        return null;
    }

    try {
        const data = await spotifyApi.searchTracks(query, { limit: 1 });
        const tracks = data.body.tracks?.items;
        
        if (!tracks || tracks.length === 0) {
            return null;
        }

        const track = tracks[0];
        
        // Search YouTube dengan format: "Artist - Title"
        const youtubeQuery = `${track.artists[0].name} - ${track.name}`;
        const youtubeResult = await searchYouTube(youtubeQuery);
        
        if (!youtubeResult) {
            return null;
        }

        return {
            ...youtubeResult,
            spotifyTrack: {
                name: track.name,
                artists: track.artists.map(a => a.name),
                album: track.album.name
            },
            source: 'spotify',
            spotifyFallback: true
        };
    } catch (error) {
        console.error('Spotify search error:', error);
        return null;
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
 * Returns { resource, error } - error will be set if YouTube fails and should fallback to Spotify
 */
async function createAudioResourceFromYouTube(url, originalQuery = null) {
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

        // Handle stream errors - mark for fallback
        stream.on('error', (error) => {
            console.error('YouTube stream error:', error.message);
            // Error will be caught by audio player error handler
        });

        const resource = createAudioResource(stream, {
            inlineVolume: true,
            metadata: { url, originalQuery }
        });

        // Handle resource errors
        resource.playStream.on('error', (error) => {
            console.error('Audio resource stream error:', error.message);
        });

        return { resource, error: null };
    } catch (error) {
        console.error('Audio resource creation error:', error);
        
        // If it's a parsing error, mark for Spotify fallback
        if (error.message && error.message.includes('parsing watch.html')) {
            return { resource: null, error: 'youtube_parsing', originalQuery };
        }
        
        return { resource: null, error: error.message, originalQuery };
    }
}

/**
 * Play next song in queue
 */
async function playNext(guildId, channel) {
    const state = getMusicState(guildId);
    
    // Store channel reference for error retry
    state.currentChannel = channel;
    
    if (state.queue.length === 0) {
        state.nowPlaying = null;
        return;
    }

    const song = state.queue.shift();
    state.nowPlaying = song;
    state.paused = false;

    try {
        // Setup connection first if needed
        if (!state.connection || state.connection.state.status === VoiceConnectionStatus.Disconnected) {
            state.connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            // Wait for connection to be ready
            try {
                await entersState(state.connection, VoiceConnectionStatus.Ready, 10000);
            } catch (error) {
                console.error('Voice connection timeout:', error);
                throw new Error('Tidak bisa connect ke voice channel. Pastikan bot memiliki permission untuk join voice channel.');
            }

            state.connection.subscribe(state.player);
        }

        // Create audio resource - with Spotify fallback on YouTube error
        let resourceResult = await createAudioResourceFromYouTube(song.url, song.originalQuery || song.title);
        
        // If YouTube fails, try Spotify fallback
        if (resourceResult.error && resourceResult.originalQuery && spotifyApi) {
            console.log('YouTube error detected, trying Spotify fallback...');
            const spotifyResult = await searchSpotifyTracks(resourceResult.originalQuery);
            
            if (spotifyResult) {
                // Update song with Spotify result
                song.url = spotifyResult.url;
                song.spotifyTrack = spotifyResult.spotifyTrack;
                song.spotifyFallback = true;
                song.source = 'spotify';
                
                console.log(`Spotify fallback success: ${spotifyResult.title}`);
                
                // Try YouTube again with Spotify result URL
                resourceResult = await createAudioResourceFromYouTube(spotifyResult.url);
            }
        }
        
        if (!resourceResult.resource) {
            if (resourceResult.error === 'youtube_parsing') {
                throw new Error('YouTube memblokir request. Spotify fallback juga tidak berhasil. Silakan coba lagi nanti.');
            }
            throw new Error(`Gagal membuat audio resource: ${resourceResult.error || 'Unknown error'}`);
        }

        const resource = resourceResult.resource;
        resource.volume?.setVolume(state.volume);

        // Play
        state.player.play(resource);

        // Handle end of song (remove all previous listeners first)
        state.player.removeAllListeners(AudioPlayerStatus.Idle);
        state.player.once(AudioPlayerStatus.Idle, () => {
            setTimeout(() => {
                if (state.queue.length > 0) {
                    playNext(guildId, channel).catch(err => {
                        console.error('Error playing next song:', err);
                        state.nowPlaying = null;
                    });
                } else {
                    state.nowPlaying = null;
                }
            }, 1000);
        });

        return song;
    } catch (error) {
        console.error('Play error:', error);
        state.nowPlaying = null;
        
        // If it's a YouTube parsing error, provide helpful message
        if (error.message && error.message.includes('parsing watch.html')) {
            throw new Error('YouTube memblokir request. Silakan gunakan search dengan kata kunci (bukan URL langsung) atau coba lagi nanti.');
        }
        
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
    async play(query, channel, member, onErrorCallback = null) {
        const guildId = channel.guild.id;
        const state = getMusicState(guildId);

        // Register error callback if provided
        if (onErrorCallback) {
            state.errorCallbacks.push(onErrorCallback);
        }

        let song = null;

        try {
            // Check if Spotify URL
            if (query.includes('spotify.com') || query.includes('spotify:')) {
                song = await getSpotifyTrack(query);
                song.originalQuery = query; // Store original query for fallback
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
                        // If search fails, try Spotify fallback
                        if (spotifyApi) {
                            console.log('YouTube search failed, trying Spotify fallback...');
                            song = await searchSpotifyTracks(query);
                        }
                        if (!song) {
                            // If Spotify also fails, try direct URL as last resort
                            try {
                                song = await getYouTubeInfo(query);
                            } catch (error) {
                                throw new Error('Tidak bisa mengakses URL YouTube dan Spotify fallback juga gagal. Coba gunakan search dengan kata kunci saja.');
                            }
                        }
                    }
                } else {
                    // Invalid URL format, try direct access first
                    try {
                        song = await getYouTubeInfo(query);
                    } catch (error) {
                        // If error, try Spotify fallback
                        if (spotifyApi) {
                            console.log('YouTube direct access failed, trying Spotify fallback...');
                            song = await searchSpotifyTracks(query);
                        }
                        if (!song) {
                            // Fallback to search
                            song = await searchYouTube(query);
                            if (!song) {
                                throw new Error('Tidak bisa mengakses URL YouTube dan Spotify fallback juga gagal. Coba gunakan search dengan kata kunci saja.');
                            }
                        }
                    }
                }
                song.originalQuery = query; // Store original query for fallback
            }
            // Search YouTube first, fallback to Spotify if fails
            else {
                song = await searchYouTube(query);
                if (!song && spotifyApi) {
                    console.log('YouTube search failed, trying Spotify fallback...');
                    song = await searchSpotifyTracks(query);
                }
                if (!song) {
                    throw new Error('Tidak bisa menemukan lagu di YouTube maupun Spotify. Coba gunakan kata kunci yang lebih spesifik.');
                }
                song.originalQuery = query; // Store original query for fallback
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

