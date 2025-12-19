"""
Music Manager untuk bot satpam
Global lock: hanya 1 music stream aktif pada satu waktu
"""
import discord
from discord.ext import commands
import asyncio
import yt_dlp
from typing import Optional, Dict, List
import os
import json
from datetime import datetime

# Global music lock
MUSIC_LOCK: Optional[Dict] = None  # {bot_number, channel_id, user_id, started_at}

# Music queue
MUSIC_QUEUE: List[Dict] = []

# Autoplay state
AUTOPLAY_ENABLED: bool = False
CURRENT_SONG: Optional[Dict] = None  # Track current song untuk autoplay

# yt-dlp options (lightweight)
YTDL_OPTIONS = {
    'format': 'bestaudio/best',
    'extractaudio': True,
    'audioformat': 'opus',
    'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
    'restrictfilenames': True,
    'noplaylist': True,
    'nocheckcertificate': True,
    'ignoreerrors': False,
    'logtostderr': False,
    'quiet': True,
    'no_warnings': True,
    'default_search': 'auto',
    'source_address': '0.0.0.0',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'opus',
        'preferredquality': '64',  # 64kbps untuk hemat resource
    }],
}

FFMPEG_OPTIONS = {
    'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
    'options': '-vn -b:a 64k'  # 64kbps audio
}


class MusicManager:
    """Manager untuk handle music playback dengan global lock"""
    
    def __init__(self):
        self.current_player: Optional[discord.PCMVolumeTransformer] = None
        self.current_source: Optional[discord.FFmpegPCMAudio] = None
        self.is_playing = False
        self.is_paused = False
    
    def is_radio_available(self) -> bool:
        """Cek apakah radio tersedia (tidak ada yang pakai)"""
        global MUSIC_LOCK
        return MUSIC_LOCK is None
    
    def get_radio_status(self) -> Optional[Dict]:
        """Get status radio yang sedang digunakan"""
        global MUSIC_LOCK
        return MUSIC_LOCK
    
    def lock_radio(self, bot_number: int, channel_id: int, user_id: int):
        """Lock radio untuk bot tertentu"""
        global MUSIC_LOCK
        MUSIC_LOCK = {
            "bot_number": bot_number,
            "channel_id": channel_id,
            "user_id": user_id,
            "started_at": datetime.now().isoformat()
        }
    
    def unlock_radio(self):
        """Unlock radio"""
        global MUSIC_LOCK
        MUSIC_LOCK = None
    
        def get_youtube_info(self, url: str) -> Dict:
        """Get info dari YouTube URL"""
        ydl = yt_dlp.YoutubeDL(YTDL_OPTIONS)
        try:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get('title', 'Unknown'),
                "duration": info.get('duration', 0),
                "url": info.get('url'),
                "thumbnail": info.get('thumbnail'),
                "source": "youtube"
            }
        except Exception as e:
            raise Exception(f"Error getting YouTube info: {str(e)}")
    
    def get_spotify_info(self, url: str, queue_all: bool = False) -> Dict:
        """Get info dari Spotify URL (convert to YouTube via Spotify API)"""
        try:
            from managers.spotify_manager import spotify_manager
            
            if not spotify_manager.is_available():
                raise Exception("Spotify API not configured. Please set client_id and client_secret in config.json")
            
            # Parse Spotify URL
            parsed = spotify_manager.parse_spotify_url(url)
            if not parsed:
                raise Exception("Invalid Spotify URL")
            
            spotify_info = None
            tracks_to_queue = []
            
            if parsed['type'] == 'track':
                # Get track info
                spotify_info = spotify_manager.get_track_info(parsed['id'])
            elif parsed['type'] == 'album':
                # Get all tracks from album
                tracks = spotify_manager.get_album_tracks(parsed['id'])
                if tracks:
                    if queue_all:
                        # Queue all tracks
                        tracks_to_queue = tracks[1:] if len(tracks) > 1 else []
                    spotify_info = spotify_manager.get_track_info(tracks[0]['spotify_id'])
            elif parsed['type'] == 'playlist':
                # Get tracks from playlist
                tracks = spotify_manager.get_playlist_tracks(parsed['id'], limit=50)
                if tracks:
                    if queue_all:
                        # Queue all tracks
                        tracks_to_queue = tracks[1:] if len(tracks) > 1 else []
                    spotify_info = spotify_manager.get_track_info(tracks[0]['spotify_id'])
            elif parsed['type'] == 'artist':
                # Get top tracks from artist
                tracks = spotify_manager.get_artist_top_tracks(parsed['id'], limit=10)
                if tracks:
                    if queue_all:
                        # Queue all tracks
                        tracks_to_queue = tracks[1:] if len(tracks) > 1 else []
                    spotify_info = spotify_manager.get_track_info(tracks[0]['spotify_id'])
            
            if not spotify_info:
                raise Exception("Could not get Spotify track info")
            
            # Convert to YouTube search
            # Search format: "Artist - Title"
            search_query = f"{spotify_info['artist']} - {spotify_info['title']}"
            
            # Search YouTube
            yt_info = self.search_youtube(search_query)
            
            # Add Spotify metadata
            yt_info['spotify_info'] = spotify_info
            yt_info['source'] = 'spotify'
            yt_info['tracks_to_queue'] = tracks_to_queue  # For queueing other tracks
            
            return yt_info
            
        except ImportError:
            # Fallback: search YouTube dengan URL
            raise Exception("Spotify API not available. Please install spotipy: pip install spotipy")
        except Exception as e:
            raise Exception(f"Error with Spotify: {str(e)}")
    
    def search_youtube(self, query: str) -> Dict:
        """Search YouTube"""
        ydl = yt_dlp.YoutubeDL(YTDL_OPTIONS)
        try:
            info = ydl.extract_info(f"ytsearch:{query}", download=False)
            if info.get('entries'):
                entry = info['entries'][0]
                return {
                    "title": entry.get('title', 'Unknown'),
                    "duration": entry.get('duration', 0),
                    "url": entry.get('url'),
                    "thumbnail": entry.get('thumbnail'),
                    "source": "youtube"
                }
            raise Exception("No results found")
        except Exception as e:
            raise Exception(f"Error searching: {str(e)}")
    
    def create_source(self, url: str) -> discord.FFmpegPCMAudio:
        """Create audio source dari URL"""
        return discord.FFmpegPCMAudio(url, **FFMPEG_OPTIONS)
    
    def add_to_queue(self, song: Dict):
        """Add song to queue"""
        global MUSIC_QUEUE
        MUSIC_QUEUE.append(song)
    
    def get_queue(self) -> List[Dict]:
        """Get current queue"""
        return MUSIC_QUEUE.copy()
    
    def clear_queue(self):
        """Clear queue"""
        global MUSIC_QUEUE
        MUSIC_QUEUE = []
    
    def get_next_in_queue(self) -> Optional[Dict]:
        """Get next song in queue"""
        global MUSIC_QUEUE
        if MUSIC_QUEUE:
            return MUSIC_QUEUE.pop(0)
        return None
    
    def set_autoplay(self, enabled: bool):
        """Enable/disable autoplay"""
        global AUTOPLAY_ENABLED
        AUTOPLAY_ENABLED = enabled
    
    def is_autoplay_enabled(self) -> bool:
        """Cek apakah autoplay enabled"""
        global AUTOPLAY_ENABLED
        return AUTOPLAY_ENABLED
    
    def set_current_song(self, song: Dict):
        """Set current song untuk autoplay"""
        global CURRENT_SONG
        CURRENT_SONG = song
    
    def get_current_song(self) -> Optional[Dict]:
        """Get current song"""
        global CURRENT_SONG
        return CURRENT_SONG
    
    def get_related_song(self, current_song: Dict) -> Optional[Dict]:
        """Get related song dari YouTube berdasarkan current song"""
        try:
            # Extract video ID dari URL jika ada
            video_id = None
            if 'url' in current_song:
                url = current_song['url']
                if 'watch?v=' in url:
                    video_id = url.split('watch?v=')[1].split('&')[0]
                elif 'youtu.be/' in url:
                    video_id = url.split('youtu.be/')[1].split('?')[0]
            
            # Get related videos dari YouTube
            ydl = yt_dlp.YoutubeDL(YTDL_OPTIONS)
            
            if video_id:
                # Try to get related videos from video page
                try:
                    # Get video info dengan related videos
                    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                    
                    # Get related videos (YouTube API doesn't expose this easily, so we'll search by title)
                    # Alternative: search by title + artist or use mix playlist
                    title = current_song.get('title', '')
                    if title:
                        # Search for similar songs
                        search_query = title
                        related_info = ydl.extract_info(f"ytsearch:{search_query}", download=False)
                        if related_info.get('entries'):
                            # Skip first result (current song) and get next one
                            entries = related_info['entries']
                            for entry in entries[1:6]:  # Get from 2nd to 6th result
                                if entry.get('url') and entry.get('url') != current_song.get('url'):
                                    return {
                                        "title": entry.get('title', 'Unknown'),
                                        "duration": entry.get('duration', 0),
                                        "url": entry.get('url'),
                                        "thumbnail": entry.get('thumbnail'),
                                        "source": "youtube",
                                        "autoplay": True
                                    }
                except:
                    pass
            
            # Fallback: search by title
            title = current_song.get('title', '')
            if title:
                # Remove common words and search
                search_query = title.split('-')[0].strip()  # Get artist/title part
                related_info = ydl.extract_info(f"ytsearch:{search_query}", download=False)
                if related_info.get('entries'):
                    entries = related_info['entries']
                    for entry in entries:
                        if entry.get('url') and entry.get('url') != current_song.get('url'):
                            return {
                                "title": entry.get('title', 'Unknown'),
                                "duration": entry.get('duration', 0),
                                "url": entry.get('url'),
                                "thumbnail": entry.get('thumbnail'),
                                "source": "youtube",
                                "autoplay": True
                            }
            
            return None
        except Exception as e:
            print(f"Error getting related song: {e}")
            return None


# Global instance
music_manager = MusicManager()

