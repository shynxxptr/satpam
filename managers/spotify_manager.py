"""
Spotify Manager untuk bot satpam
Handle Spotify API integration
"""
import os
import json
from typing import Optional, Dict, List
import re

try:
    import spotipy
    from spotipy.oauth2 import SpotifyClientCredentials
    SPOTIFY_AVAILABLE = True
except ImportError:
    SPOTIFY_AVAILABLE = False
    spotipy = None
    SpotifyClientCredentials = None


class SpotifyManager:
    """Manager untuk handle Spotify API"""
    
    def __init__(self):
        self.client_id: Optional[str] = None
        self.client_secret: Optional[str] = None
        self.spotify: Optional[spotipy.Spotify] = None
        self._load_credentials()
    
    def _load_credentials(self):
        """Load Spotify credentials dari config atau environment"""
        # Try config.json first
        try:
            with open('config.json', 'r') as f:
                config = json.load(f)
                spotify_config = config.get('spotify', {})
                self.client_id = spotify_config.get('client_id')
                self.client_secret = spotify_config.get('client_secret')
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            pass
        
        # Fallback to environment variables
        if not self.client_id:
            self.client_id = os.getenv('SPOTIFY_CLIENT_ID')
        if not self.client_secret:
            self.client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        
        # Initialize Spotify client if credentials available
        if SPOTIFY_AVAILABLE and self.client_id and self.client_secret:
            try:
                client_credentials_manager = SpotifyClientCredentials(
                    client_id=self.client_id,
                    client_secret=self.client_secret
                )
                self.spotify = spotipy.Spotify(client_credentials_manager=client_credentials_manager)
            except Exception as e:
                print(f"⚠️  Error initializing Spotify client: {e}")
                self.spotify = None
    
    def is_available(self) -> bool:
        """Cek apakah Spotify API tersedia"""
        return SPOTIFY_AVAILABLE and self.spotify is not None
    
    def parse_spotify_url(self, url: str) -> Optional[Dict]:
        """Parse Spotify URL dan return type dan ID"""
        # Format: https://open.spotify.com/track/TRACK_ID
        # Format: https://open.spotify.com/album/ALBUM_ID
        # Format: https://open.spotify.com/playlist/PLAYLIST_ID
        
        patterns = {
            'track': r'spotify\.com/track/([a-zA-Z0-9]+)',
            'album': r'spotify\.com/album/([a-zA-Z0-9]+)',
            'playlist': r'spotify\.com/playlist/([a-zA-Z0-9]+)',
            'artist': r'spotify\.com/artist/([a-zA-Z0-9]+)'
        }
        
        for item_type, pattern in patterns.items():
            match = re.search(pattern, url)
            if match:
                return {
                    'type': item_type,
                    'id': match.group(1)
                }
        
        return None
    
    def get_track_info(self, track_id: str) -> Optional[Dict]:
        """Get track info dari Spotify"""
        if not self.is_available():
            return None
        
        try:
            track = self.spotify.track(track_id)
            return {
                'title': track['name'],
                'artist': ', '.join([artist['name'] for artist in track['artists']]),
                'album': track['album']['name'],
                'duration_ms': track['duration_ms'],
                'thumbnail': track['album']['images'][0]['url'] if track['album']['images'] else None,
                'spotify_url': track['external_urls']['spotify'],
                'preview_url': track.get('preview_url'),
                'spotify_id': track_id
            }
        except Exception as e:
            print(f"Error getting Spotify track: {e}")
            return None
    
    def get_album_tracks(self, album_id: str) -> List[Dict]:
        """Get all tracks dari album"""
        if not self.is_available():
            return []
        
        try:
            album = self.spotify.album(album_id)
            tracks = []
            for track in album['tracks']['items']:
                tracks.append({
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'spotify_id': track['id'],
                    'duration_ms': track['duration_ms']
                })
            return tracks
        except Exception as e:
            print(f"Error getting album tracks: {e}")
            return []
    
    def get_playlist_tracks(self, playlist_id: str, limit: int = 50) -> List[Dict]:
        """Get tracks dari playlist"""
        if not self.is_available():
            return []
        
        try:
            results = self.spotify.playlist_tracks(playlist_id, limit=limit)
            tracks = []
            for item in results['items']:
                if item['track']:
                    track = item['track']
                    tracks.append({
                        'title': track['name'],
                        'artist': ', '.join([artist['name'] for artist in track['artists']]),
                        'spotify_id': track['id'],
                        'duration_ms': track['duration_ms']
                    })
            return tracks
        except Exception as e:
            print(f"Error getting playlist tracks: {e}")
            return []
    
    def get_artist_top_tracks(self, artist_id: str, limit: int = 10) -> List[Dict]:
        """Get top tracks dari artist"""
        if not self.is_available():
            return []
        
        try:
            results = self.spotify.artist_top_tracks(artist_id)
            tracks = []
            for track in results['tracks'][:limit]:
                tracks.append({
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'spotify_id': track['id'],
                    'duration_ms': track['duration_ms']
                })
            return tracks
        except Exception as e:
            print(f"Error getting artist top tracks: {e}")
            return []
    
    def search_track(self, query: str, limit: int = 1) -> Optional[Dict]:
        """Search track di Spotify"""
        if not self.is_available():
            return None
        
        try:
            results = self.spotify.search(q=query, type='track', limit=limit)
            if results['tracks']['items']:
                track = results['tracks']['items'][0]
                return {
                    'title': track['name'],
                    'artist': ', '.join([artist['name'] for artist in track['artists']]),
                    'album': track['album']['name'],
                    'duration_ms': track['duration_ms'],
                    'thumbnail': track['album']['images'][0]['url'] if track['album']['images'] else None,
                    'spotify_url': track['external_urls']['spotify'],
                    'preview_url': track.get('preview_url'),
                    'spotify_id': track['id']
                }
            return None
        except Exception as e:
            print(f"Error searching Spotify: {e}")
            return None


# Global instance
spotify_manager = SpotifyManager()

