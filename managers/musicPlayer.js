import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { YouTube } from 'youtube-sr';
import SpotifyWebApi from 'spotify-web-api-node';
import { getSpotifyCredentials, getYouTubeCookiesPath, hasYouTubeCookies } from '../utils/config.js';
import path from 'path';
import fs from 'fs';

// DisTube instance (will be initialized when we have client)
let distube = null;

/**
 * Initialize DisTube with Discord client
 * According to https://distube.js.org/
 */
export function initDisTube(client) {
    if (!distube) {
        // Get YouTube cookies path if available
        const cookiesPath = getYouTubeCookiesPath();
        const hasCookies = hasYouTubeCookies();
        
        // Build extractor args for yt-dlp
        const extractorArgs = [
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/',
            '--add-header', 'Accept-Language:en-US,en;q=0.9',
            '--extractor-args', 'youtube:player_client=web'
        ];
        
        // Add cookies file if available (helps avoid bot detection)
        if (hasCookies && cookiesPath) {
            extractorArgs.push('--cookies', cookiesPath);
            console.log(`✅ YouTube cookies file ditemukan: ${cookiesPath}`);
            console.log('   Menggunakan cookies untuk menghindari bot detection...');
        } else {
            console.log('⚠️  YouTube cookies file tidak ditemukan.');
            console.log('   Tambahkan "youtube_cookies_path" di config.json dan file cookies.txt untuk hasil lebih baik.');
        }
        
        // Configure yt-dlp plugin for better YouTube bot detection avoidance
        const ytDlpPlugin = new YtDlpPlugin({
            update: true, // Auto-update yt-dlp
            extractorArgs: extractorArgs
        });
        
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
            plugins: [ytDlpPlugin] // Use yt-dlp plugin for better YouTube handling
        });
        
        // Setup DisTube event handlers
        distube.on('playSong', (queue, song) => {
            console.log(`🎵 Playing: ${song.name} (${song.formattedDuration})`);
        });
        
        distube.on('addSong', (queue, song) => {
            console.log(`➕ Added to queue: ${song.name}`);
        });
        
        distube.on('error', async (channel, error) => {
            console.error('❌ DisTube error:', error);
            console.error('Error details:', {
                message: error.message,
                name: error.name,
                channel: channel?.id,
                channelType: channel?.type,
                channelGuild: channel?.guild?.id
            });
            console.log(`[Error Handler] Total stored queries: ${originalQueries.size}`);
            if (originalQueries.size > 0) {
                console.log(`[Error Handler] Stored guildIds: ${Array.from(originalQueries.keys()).join(', ')}`);
            }
            
            // Get guildId from channel or try to find from stored queries
            let guildId = null;
            if (channel && channel.guild) {
                guildId = channel.guild.id;
                console.log(`[Error Handler] Got guildId from channel: ${guildId}`);
            } else {
                // Try to find guildId from stored queries (find first match)
                for (const [gId, stored] of originalQueries.entries()) {
                    guildId = gId;
                    console.log(`[Error Handler] Got guildId from stored queries: ${guildId}`);
                    break;
                }
            }
            
            if (!guildId) {
                console.error('[Error Handler] Cannot determine guildId from error, skipping Spotify fallback');
                console.error('[Error Handler] Channel:', channel);
                console.error('[Error Handler] Stored queries:', Array.from(originalQueries.keys()));
                return;
            }
            
            // Check if it's YouTube bot detection error
            const isBotDetection = error.message && (
                error.message.includes('Sign in to confirm') ||
                error.message.includes('not a bot') ||
                error.message.includes('bot detection') ||
                error.name === 'UnrecoverableError' ||
                error.name === 'PlayingError'
            );
            
            console.log(`[Error Handler] Error detected - isBotDetection: ${isBotDetection}, guildId: ${guildId}, spotifyApi: ${spotifyApi ? 'available' : 'not available'}`);
            
            // Try Spotify fallback if YouTube bot detection error
            if (isBotDetection && spotifyApi) {
                const storedQuery = originalQueries.get(guildId);
                console.log(`Stored query found: ${storedQuery ? 'YES' : 'NO'}`);
                
                if (storedQuery && !storedQuery.query.includes('spotify')) {
                    console.log('YouTube bot detection detected, trying Spotify fallback...');
                    console.log(`Original query: "${storedQuery.query}"`);
                    
                    try {
                        const spotifyResult = await searchSpotifyTracks(storedQuery.query);
                        if (spotifyResult) {
                            console.log(`Spotify fallback success: ${spotifyResult.title}`);
                            
                            // Try play with Spotify result - use better search query format
                            // Use "Artist - Title" format, avoiding duplication
                            const artist = spotifyResult.spotifyTrack?.artists[0] || '';
                            const title = spotifyResult.title || spotifyResult.spotifyTrack?.name || '';
                            // Remove artist name from title if already included to avoid duplication
                            const cleanTitle = title.replace(new RegExp(`^${artist}\\s*-?\\s*`, 'i'), '').trim();
                            const searchQuery = cleanTitle ? `${artist} - ${cleanTitle}` : title;
                            
                            console.log(`Trying to play with search query: "${searchQuery}"`);
                            
                            // Mark as fallback to prevent infinite retry
                            originalQueries.set(guildId, {
                                ...storedQuery,
                                isFallback: true
                            });
                            
                            await distube.play(storedQuery.voiceChannel, searchQuery, {
                                member: storedQuery.member,
                                textChannel: null,
                                skip: false
                            });
                            
                            // Wait a bit to ensure queue is created
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Notify success
                            const callbacks = errorCallbacks.get(guildId);
                            if (callbacks && callbacks.length > 0) {
                                callbacks.forEach(callback => {
                                    try {
                                        callback(null, null, `✅ Auto-fallback ke Spotify: ${spotifyResult.title}`);
                                    } catch (err) {
                                        console.error('Error in success callback:', err);
                                    }
                                });
                            }
                            
                            originalQueries.delete(guildId);
                            errorCallbacks.delete(guildId);
                            return; // Success, don't notify error
                        } else {
                            console.log('Spotify search returned no results');
                        }
                    } catch (fallbackError) {
                        console.error('Spotify fallback error:', fallbackError);
                    }
                } else {
                    if (!storedQuery) {
                        console.log('No stored query found for fallback');
                    } else {
                        console.log('Query is already a Spotify query, skipping fallback');
                    }
                }
            }
            
            // Notify error callbacks
            const callbacks = errorCallbacks.get(guildId);
            if (callbacks && callbacks.length > 0) {
                callbacks.forEach(callback => {
                    try {
                        callback(error.message || 'Error memutar musik', null);
                    } catch (err) {
                        console.error('Error in error callback:', err);
                    }
                });
                errorCallbacks.delete(guildId);
            }
            
            // Clean up stored query
            originalQueries.delete(guildId);
        });
        
        distube.on('noRelated', (queue) => {
            console.log('ℹ️  No related songs found');
        });
        
        console.log('✅ DisTube initialized');
    }
    return distube;
}

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

// Error callbacks storage (simple map for user notifications)
const errorCallbacks = new Map(); // guildId -> array of callbacks

// Store original queries for Spotify fallback on YouTube bot detection
const originalQueries = new Map(); // guildId -> { query, voiceChannel, member, isFallback }

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

// Functions createAudioResourceFromYouTube and playNext removed - DisTube handles playback automatically

/**
 * Music Player Manager
 */
export const musicPlayer = {
    /**
     * Play music using DisTube
     * According to https://distube.js.org/ - using distube.play() directly
     * @param {string} query - Search query or URL
     * @param {VoiceChannel} voiceChannel - User's voice channel (required by DisTube)
     * @param {GuildMember} member - Discord member who requested
     * @param {Function} onErrorCallback - Callback for errors
     */
    async play(query, voiceChannel, member, onErrorCallback = null) {
        if (!distube) {
            throw new Error('DisTube belum di-initialize. Pastikan bot sudah ready.');
        }

        if (!voiceChannel) {
            throw new Error('User harus berada di voice channel untuk play music!');
        }

        const guildId = voiceChannel.guild.id;
        
        // Store ORIGINAL query BEFORE any modification for Spotify fallback
        const originalQuery = query;
        console.log(`[MusicPlayer] Storing original query for guild ${guildId}: "${originalQuery}"`);

        // Register error callback if provided
        if (onErrorCallback) {
            if (!errorCallbacks.has(guildId)) {
                errorCallbacks.set(guildId, []);
            }
            errorCallbacks.get(guildId).push(onErrorCallback);
        }
        
        // Store original query for Spotify fallback on YouTube bot detection
        originalQueries.set(guildId, {
            query: originalQuery, // Store original, not modified query
            voiceChannel: voiceChannel,
            member: member
        });
        console.log(`[MusicPlayer] Stored query in map. Total stored: ${originalQueries.size}`);

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
            // IMPORTANT: distube.play() requires VoiceChannel, not TextChannel!
            try {
                await distube.play(voiceChannel, query, {
                    member: member,
                    textChannel: null, // We'll handle messages separately
                    skip: false
                });
            } catch (playError) {
                console.error('[MusicPlayer] distube.play() threw error:', playError);
                
                // Check if it's YouTube bot detection error - handle immediately
                const isBotDetection = playError.message && (
                    playError.message.includes('Sign in to confirm') ||
                    playError.message.includes('not a bot') ||
                    playError.name === 'UnrecoverableError' ||
                    playError.name === 'PlayingError'
                );
                
                if (isBotDetection && spotifyApi) {
                    console.log('[MusicPlayer] Bot detection in play() - trying Spotify fallback immediately...');
                    const storedQuery = originalQueries.get(guildId);
                    
                    if (storedQuery && !storedQuery.query.includes('spotify') && !storedQuery.isFallback) {
                        try {
                            const spotifyResult = await searchSpotifyTracks(storedQuery.query);
                            if (spotifyResult) {
                                console.log(`[MusicPlayer] Spotify fallback success: ${spotifyResult.title}`);
                                
                                // Try play with Spotify result - use better search query format
                                const artist = spotifyResult.spotifyTrack?.artists[0] || '';
                                const title = spotifyResult.title || spotifyResult.spotifyTrack?.name || '';
                                const cleanTitle = title.replace(new RegExp(`^${artist}\\s*-?\\s*`, 'i'), '').trim();
                                const searchQuery = cleanTitle ? `${artist} - ${cleanTitle}` : title;
                                
                                console.log(`[MusicPlayer] Trying to play with search query: "${searchQuery}"`);
                                
                                // Mark as fallback to prevent infinite retry
                                originalQueries.set(guildId, {
                                    ...storedQuery,
                                    isFallback: true
                                });
                                
                                await distube.play(voiceChannel, searchQuery, {
                                    member: member,
                                    textChannel: null,
                                    skip: false
                                });
                                
                                // Wait a bit to ensure queue is created
                                await new Promise(resolve => setTimeout(resolve, 500));
                                
                                const queue = distube.getQueue(guildId);
                                if (!queue) {
                                    throw new Error('Gagal membuat queue setelah Spotify fallback');
                                }
                                
                                const song = queue.songs[queue.songs.length - 1];
                                
                                if (onErrorCallback) {
                                    onErrorCallback(null, null, `✅ Auto-fallback ke Spotify: ${spotifyResult.title}`);
                                }
                                
                                originalQueries.delete(guildId);
                                
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
                            console.error('[MusicPlayer] Spotify fallback error:', fallbackError);
                        }
                    }
                }
                
                // Re-throw if not handled
                throw playError;
            }

            // Get the queue to return song info
            const queue = distube.getQueue(guildId);
            if (!queue) {
                throw new Error('Gagal membuat queue');
            }

            // Get the song that was added/playing
            const song = queue.songs[queue.songs.length - 1];
            
            // Clean up stored query on success
            originalQueries.delete(guildId);
            
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
            console.error('[MusicPlayer] Play error caught:', error.message);
            
            // Don't delete stored query immediately - error handler might need it for Spotify fallback
            // Only delete if it's marked as fallback (already tried Spotify)
            const storedQuery = originalQueries.get(guildId);
            if (storedQuery && storedQuery.isFallback) {
                originalQueries.delete(guildId);
            }
            
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
                            // Try again with Spotify result - use better search query format
                            const artist = spotifyResult.spotifyTrack?.artists[0] || '';
                            const title = spotifyResult.title || spotifyResult.spotifyTrack?.name || '';
                            const cleanTitle = title.replace(new RegExp(`^${artist}\\s*-?\\s*`, 'i'), '').trim();
                            const searchQuery = cleanTitle ? `${artist} - ${cleanTitle}` : title;
                            
                            await distube.play(voiceChannel, searchQuery, {
                                member: member,
                                textChannel: null,
                                skip: false
                            });
                            
                            // Wait a bit to ensure queue is created
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            const queue = distube.getQueue(guildId);
                            if (!queue) {
                                throw new Error('Gagal membuat queue setelah Spotify fallback');
                            }
                            
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
        if (!distube) return false;
        const queue = distube.getQueue(guildId);
        if (queue) {
            queue.stop();
            queue.voice.connection.destroy();
            return true;
        }
        return false;
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

