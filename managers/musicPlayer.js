import { DisTube } from 'distube';
import { createAudioPlayer, createAudioResource, AudioPlayerStatus, joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { YouTube } from 'youtube-sr';
import SpotifyWebApi from 'spotify-web-api-node';
import { getSpotifyCredentials } from '../utils/config.js';

// DisTube instance (will be initialized when we have client)
let distube = null;

/**
 * Initialize DisTube with Discord client
 * According to https://distube.js.org/
 */
export function initDisTube(client) {
    if (!distube) {
        distube = new DisTube(client, {
            leaveOnStop: false,
            leaveOnFinish: false,
            leaveOnEmpty: false,
            emptyCooldown: 0,
            nsfw: false,
            emitNewSongOnly: true,
            emitAddSongWhenCreatingQueue: false,
            emitAddListWhenCreatingQueue: false,
            searchSongs: 0,
            customFilters: {},
            // DisTube handles YouTube bot detection better
            youtubeCookie: process.env.YOUTUBE_COOKIE || undefined,
            youtubeIdentityToken: process.env.YOUTUBE_IDENTITY_TOKEN || undefined
        });
        
        // Setup DisTube event handlers
        distube.on('playSong', (queue, song) => {
            console.log(`🎵 Playing: ${song.name} (${song.formattedDuration})`);
        });
        
        distube.on('addSong', (queue, song) => {
            console.log(`➕ Added to queue: ${song.name}`);
        });
        
        distube.on('error', (channel, error) => {
            console.error('❌ DisTube error:', error);
        });
        
        distube.on('noRelated', (queue) => {
            console.log('ℹ️  No related songs found');
        });
        
        console.log('✅ DisTube initialized');
    }
    return distube;
}

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
 * Search YouTube for query using DisTube
 */
async function searchYouTube(query) {
    // Try DisTube first (better bot detection handling)
    if (distube) {
        try {
            const results = await distube.search(query, { limit: 1, safeSearch: false });
            if (results && results.length > 0) {
                const song = results[0];
                return {
                    url: song.url,
                    title: song.name || song.title,
                    duration: song.formattedDuration || song.durationFormatted,
                    thumbnail: song.thumbnail || song.thumbnailURL,
                    source: 'youtube'
                };
            }
        } catch (error) {
            console.error('DisTube search error:', error);
            // Fallback to youtube-sr
        }
    }
    
    // Fallback to youtube-sr
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
 * Get YouTube video info using DisTube
 */
async function getYouTubeInfo(url) {
    // Try DisTube first if available (better bot detection)
    if (distube) {
        try {
            const results = await distube.search(url, { limit: 1, safeSearch: false });
            if (results && results.length > 0) {
                const song = results[0];
                return {
                    url: song.url,
                    title: song.name || song.title,
                    duration: song.formattedDuration || song.durationFormatted,
                    thumbnail: song.thumbnail || song.thumbnailURL,
                    source: 'youtube'
                };
            }
        } catch (error) {
            console.error('DisTube search error:', error);
            // Fallback to youtube-sr
        }
    }
    
    // Fallback to youtube-sr
    try {
        const results = await YouTube.search(url, { limit: 1, type: 'video' });
        if (results.length === 0) {
            throw new Error('Tidak bisa menemukan video YouTube');
        }
        
        const video = results[0];
        return {
            url: video.url,
            title: video.title,
            duration: video.durationFormatted,
            thumbnail: video.thumbnail?.url,
            source: 'youtube'
        };
    } catch (error) {
        console.error('YouTube info error:', error);
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
 * Check if URL is YouTube URL
 */
function isYouTubeURL(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(url);
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
 * Create audio resource from YouTube URL using DisTube's ytdl-core
 * Returns { resource, error } - error will be set if YouTube fails and should fallback to Spotify
 */
async function createAudioResourceFromYouTube(url, originalQuery = null) {
    try {
        // Use @distube/ytdl-core which has better bot detection handling than regular ytdl-core
        
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
        if (resource.playStream) {
            resource.playStream.on('error', (error) => {
                console.error('Audio resource stream error:', error.message);
            });
        }

        return { resource, error: null };
    } catch (error) {
        console.error('Audio resource creation error:', error);
        
        // If it's a parsing error, mark for Spotify fallback
        if (error.message && (error.message.includes('parsing watch.html') || error.message.includes('Sign in') || error.message.includes('bot'))) {
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
     * Play music using DisTube
     * According to https://distube.js.org/ - using distube.play() directly
     */
    async play(query, channel, member, onErrorCallback = null) {
        if (!distube) {
            throw new Error('DisTube belum di-initialize. Pastikan bot sudah ready.');
        }

        const guildId = channel.guild.id;
        const state = getMusicState(guildId);

        // Register error callback if provided
        if (onErrorCallback) {
            state.errorCallbacks.push(onErrorCallback);
        }

        try {
            // Handle Spotify URL - convert to YouTube search first
            if (query.includes('spotify.com') || query.includes('spotify:')) {
                if (spotifyApi) {
                    const spotifySong = await getSpotifyTrack(query);
                    if (spotifySong && spotifySong.spotifyTrack) {
                        // Convert Spotify to YouTube search query
                        const searchQuery = `${spotifySong.spotifyTrack.artists.join(' ')} ${spotifySong.spotifyTrack.name}`;
                        query = searchQuery;
                        console.log(`Spotify track converted to search: ${searchQuery}`);
                    }
                } else {
                    throw new Error('Spotify API tidak dikonfigurasi');
                }
            }

            // Use DisTube to play - it handles search, resolve, and playback automatically
            // DisTube supports YouTube, Spotify (via plugin), SoundCloud, and 700+ other sites
            await distube.play(channel, query, {
                member: member,
                textChannel: null, // We'll handle messages separately
                skip: false
            });

            // Get the queue to return song info
            const queue = distube.getQueue(guildId);
            if (!queue) {
                throw new Error('Gagal membuat queue');
            }

            // Get the song that was added/playing
            const song = queue.songs[queue.songs.length - 1];
            
            return {
                url: song.url,
                title: song.name || song.title,
                duration: song.formattedDuration || song.durationFormatted,
                thumbnail: song.thumbnail || song.thumbnailURL,
                source: song.source || 'youtube',
                requestedBy: member.id,
                requestedByUsername: member.user.tag
            };
        } catch (error) {
            // Handle DisTube errors
            if (onErrorCallback) {
                onErrorCallback(error.message, null);
            }
            
            // Try Spotify fallback if YouTube fails
            if (error.message && (error.message.includes('No results') || error.message.includes('No song found'))) {
                if (spotifyApi && !query.includes('spotify')) {
                    console.log('DisTube search failed, trying Spotify fallback...');
                    try {
                        const spotifyResult = await searchSpotifyTracks(query);
                        if (spotifyResult) {
                            // Try again with Spotify result
                            const searchQuery = `${spotifyResult.spotifyTrack?.artists.join(' ') || ''} ${spotifyResult.title}`;
                            await distube.play(channel, searchQuery, {
                                member: member,
                                textChannel: null,
                                skip: false
                            });
                            
                            const queue = distube.getQueue(guildId);
                            const song = queue.songs[queue.songs.length - 1];
                            
                            return {
                                url: song.url,
                                title: song.name || song.title,
                                duration: song.formattedDuration || song.durationFormatted,
                                thumbnail: song.thumbnail || song.thumbnailURL,
                                source: 'spotify',
                                spotifyTrack: spotifyResult.spotifyTrack,
                                requestedBy: member.id,
                                requestedByUsername: member.user.tag
                            };
                        }
                    } catch (fallbackError) {
                        console.error('Spotify fallback error:', fallbackError);
                    }
                }
            }
            
            throw error;
        }
    },

    /**
     * Stop music using DisTube
     */
    stop(guildId) {
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        if (queue) {
            queue.stop();
            return true;
        }
        return false;
    },

    /**
     * Pause music using DisTube
     */
    pause(guildId) {
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        if (queue && queue.playing) {
            queue.pause();
            return true;
        }
        return false;
    },

    /**
     * Resume music using DisTube
     */
    resume(guildId) {
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        if (queue && queue.paused) {
            queue.resume();
            return true;
        }
        return false;
    },

    /**
     * Get now playing using DisTube
     */
    getNowPlaying(guildId) {
        if (!distube) return null;
        const queue = distube.getQueue(guildId);
        if (queue && queue.songs.length > 0) {
            const song = queue.songs[0];
            return {
                url: song.url,
                title: song.name || song.title,
                duration: song.formattedDuration || song.durationFormatted,
                thumbnail: song.thumbnail || song.thumbnailURL,
                source: song.source || 'youtube'
            };
        }
        return null;
    },

    /**
     * Get queue using DisTube
     */
    getQueue(guildId) {
        if (!distube) return [];
        const queue = distube.getQueue(guildId);
        if (queue) {
            return queue.songs.map(song => ({
                url: song.url,
                title: song.name || song.title,
                duration: song.formattedDuration || song.durationFormatted,
                thumbnail: song.thumbnail || song.thumbnailURL,
                source: song.source || 'youtube'
            }));
        }
        return [];
    },

    /**
     * Skip current song using DisTube
     */
    skip(guildId) {
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        if (queue && queue.songs.length > 1) {
            queue.skip();
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
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        return queue ? queue.playing : false;
    },

    /**
     * Check if paused using DisTube
     */
    isPaused(guildId) {
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        return queue ? queue.paused : false;
    }
};

