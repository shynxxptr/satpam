import { DisTube } from 'distube';
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
            customFilters: {}
            // DisTube handles YouTube bot detection internally
            // No need to configure YouTube cookies manually
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
            
            // Notify error callbacks
            if (channel && channel.guild) {
                const guildId = channel.guild.id;
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
            }
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

        // Register error callback if provided
        if (onErrorCallback) {
            if (!errorCallbacks.has(guildId)) {
                errorCallbacks.set(guildId, []);
            }
            errorCallbacks.get(guildId).push(onErrorCallback);
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
            // IMPORTANT: distube.play() requires VoiceChannel, not TextChannel!
            await distube.play(voiceChannel, query, {
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
                            await distube.play(voiceChannel, searchQuery, {
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

