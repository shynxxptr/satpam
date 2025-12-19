"""
Config validator untuk memastikan config valid sebelum bot start
"""
import json
import os
from typing import Dict, List, Optional

def validate_config(config_path: str = 'config.json') -> tuple[bool, List[str], List[str]]:
    """Validate config file
    
    Returns:
        tuple: (is_valid, errors, warnings)
    """
    errors = []
    warnings = []
    
    # Check if file exists
    if not os.path.exists(config_path):
        errors.append(f"❌ Config file '{config_path}' tidak ditemukan!")
        return False, errors
    
    # Try to load JSON
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"❌ Config file bukan valid JSON: {e}")
        return False, errors
    except Exception as e:
        errors.append(f"❌ Error membaca config file: {e}")
        return False, errors
    
    # Check required fields
    required_fields = {
        'bot_tokens': list,
    }
    
    for field, field_type in required_fields.items():
        if field not in config:
            errors.append(f"❌ Missing required field: '{field}'")
        elif not isinstance(config[field], field_type):
            errors.append(f"❌ Field '{field}' harus bertipe {field_type.__name__}")
        elif field == 'bot_tokens' and len(config[field]) == 0:
            errors.append(f"❌ Field 'bot_tokens' tidak boleh kosong")
    
    # Validate bot tokens
    if 'bot_tokens' in config:
        tokens = config['bot_tokens']
        # Filter valid tokens
        valid_tokens = [
            token for token in tokens 
            if token and token not in ['', 'token_bot_1_disini', 'token_bot_2_disini', 
                                      'token_bot_3_disini', 'token_bot_4_disini', 'token_bot_5_disini']
        ]
        
        if len(valid_tokens) == 0:
            errors.append("❌ Tidak ada bot token yang valid! Minimal 1 token diperlukan.")
        elif len(valid_tokens) < len(tokens):
            placeholder_count = len(tokens) - len(valid_tokens)
            warnings.append(f"⚠️  {placeholder_count} token(s) masih placeholder (akan diabaikan)")
        
        # Check individual tokens (only warn, don't error)
        for i, token in enumerate(tokens, 1):
            if not token or token in ['', f'token_bot_{i}_disini']:
                # Only warn if it's in the first few tokens
                if i <= 3:
                    warnings.append(f"⚠️  Bot #{i} token belum di-set (masih placeholder)")
    
    # Validate role_ids if exists
    if 'role_ids' in config:
        role_ids = config.get('role_ids', {})
        if 'donatur' in role_ids and not isinstance(role_ids['donatur'], list):
            errors.append("❌ 'role_ids.donatur' harus berupa list")
        if 'loyalist' in role_ids and not isinstance(role_ids['loyalist'], list):
            errors.append("❌ 'role_ids.loyalist' harus berupa list")
    
    # Validate idle channel ID
    if 'idle_voice_channel_id' in config:
        idle_id = config['idle_voice_channel_id']
        if not isinstance(idle_id, (int, str)):
            errors.append("❌ 'idle_voice_channel_id' harus berupa number atau string")
    
    # Validate music_enabled_bot
    if 'music_enabled_bot' in config:
        music_bot = config['music_enabled_bot']
        if not isinstance(music_bot, int):
            errors.append("❌ 'music_enabled_bot' harus berupa number")
        elif music_bot < 1:
            errors.append("❌ 'music_enabled_bot' harus >= 1")
        elif music_bot > 5:
            errors.append("❌ 'music_enabled_bot' maksimal 5")
        else:
            # Check if music_bot number is valid based on available tokens
            if 'bot_tokens' in config:
                tokens = config['bot_tokens']
                valid_tokens = [
                    token for token in tokens 
                    if token and token not in ['', 'token_bot_1_disini', 'token_bot_2_disini', 
                                              'token_bot_3_disini', 'token_bot_4_disini', 'token_bot_5_disini']
                ]
                if music_bot > len(valid_tokens):
                    errors.append(f"⚠️  'music_enabled_bot'={music_bot} tapi hanya ada {len(valid_tokens)} bot token(s)")
    
    # Validate Spotify config if exists
    if 'spotify' in config:
        spotify = config['spotify']
        if not isinstance(spotify, dict):
            errors.append("❌ 'spotify' harus berupa object")
        else:
            if 'client_id' not in spotify or not spotify['client_id']:
                warnings.append("⚠️  'spotify.client_id' tidak di-set (Spotify API tidak akan bekerja)")
            if 'client_secret' not in spotify or not spotify['client_secret']:
                warnings.append("⚠️  'spotify.client_secret' tidak di-set (Spotify API tidak akan bekerja)")
    
    return (len(errors) == 0, errors, warnings)

def print_validation_results(valid: bool, errors: List[str], warnings: List[str] = None):
    """Print validation results"""
    if warnings is None:
        warnings = []
    
    if valid:
        print("✅ Config file valid!")
        # Print warnings if any
        if warnings:
            for warning in warnings:
                print(f"  {warning}")
    else:
        print("❌ Config file memiliki error:")
        for error in errors:
            print(f"  {error}")
        # Also print warnings
        if warnings:
            for warning in warnings:
                print(f"  {warning}")

