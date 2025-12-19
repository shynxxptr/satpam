"""
Startup checks untuk memastikan semua dependencies dan config ready
"""
import sys
import os
from pathlib import Path

def check_dependencies():
    """Check if all required dependencies are installed"""
    missing = []
    
    required = {
        'discord': 'discord.py',
        'dotenv': 'python-dotenv'
    }
    
    optional = {
        'yt_dlp': 'yt-dlp (untuk music)',
        'spotipy': 'spotipy (untuk Spotify API)',
        'psutil': 'psutil (untuk resource monitoring)'
    }
    
    print("🔍 Checking dependencies...")
    
    # Check required
    for module, name in required.items():
        try:
            __import__(module)
            print(f"  ✅ {name}")
        except ImportError:
            print(f"  ❌ {name} - REQUIRED!")
            missing.append(name)
    
    # Check optional
    for module, name in optional.items():
        try:
            __import__(module)
            print(f"  ✅ {name} (optional)")
        except ImportError:
            print(f"  ⚠️  {name} (optional) - tidak terinstall")
    
    if missing:
        print(f"\n❌ Missing required dependencies: {', '.join(missing)}")
        print("Install dengan: pip install -r requirements.txt")
        return False
    
    return True

def check_config():
    """Check config file"""
    from utils.config_validator import validate_config, print_validation_results
    
    print("\n🔍 Checking config file...")
    
    if not os.path.exists('config.json'):
        print("  ❌ config.json tidak ditemukan!")
        print("  💡 Copy config.json.example ke config.json dan edit")
        return False
    
    valid, errors = validate_config()
    print_validation_results(valid, errors)
    
    return valid

def check_directories():
    """Check and create required directories"""
    print("\n🔍 Checking directories...")
    
    dirs = ['logs', 'backups']
    
    for dir_name in dirs:
        dir_path = Path(dir_name)
        if not dir_path.exists():
            dir_path.mkdir(exist_ok=True)
            print(f"  ✅ Created directory: {dir_name}/")
        else:
            print(f"  ✅ Directory exists: {dir_name}/")
    
    return True

def check_permissions():
    """Check file permissions"""
    print("\n🔍 Checking permissions...")
    
    # Check if we can write to current directory
    try:
        test_file = Path('.write_test')
        test_file.touch()
        test_file.unlink()
        print("  ✅ Write permission OK")
        return True
    except Exception as e:
        print(f"  ❌ Cannot write to current directory: {e}")
        return False

def run_all_checks():
    """Run all startup checks"""
    print("=" * 50)
    print("🛡️  SATPAM BOT - STARTUP CHECKS")
    print("=" * 50)
    print()
    
    checks = [
        ("Dependencies", check_dependencies),
        ("Config", check_config),
        ("Directories", check_directories),
        ("Permissions", check_permissions)
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"  ❌ Error in {name} check: {e}")
            results.append((name, False))
    
    print("\n" + "=" * 50)
    print("📊 CHECK RESULTS")
    print("=" * 50)
    
    all_passed = True
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {name}")
        if not result:
            all_passed = False
    
    print()
    
    if all_passed:
        print("✅ All checks passed! Bot siap untuk dijalankan.")
        return True
    else:
        print("❌ Beberapa checks gagal. Silakan perbaiki sebelum menjalankan bot.")
        return False

if __name__ == "__main__":
    success = run_all_checks()
    sys.exit(0 if success else 1)

