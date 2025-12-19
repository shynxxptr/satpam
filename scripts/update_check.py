#!/usr/bin/env python3
"""
Script untuk check update availability dan security vulnerabilities
"""
import subprocess
import sys
import json
from packaging import version

def check_outdated():
    """Check for outdated packages"""
    print("🔍 Checking for outdated packages...")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "list", "--outdated", "--format=json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            outdated = json.loads(result.stdout)
            if outdated:
                print(f"\n⚠️  Found {len(outdated)} outdated package(s):")
                for pkg in outdated:
                    print(f"   - {pkg['name']}: {pkg['version']} → {pkg['latest_version']}")
                return outdated
            else:
                print("✅ All packages are up to date!")
                return []
        else:
            print("❌ Error checking outdated packages")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def check_security():
    """Check for known security vulnerabilities"""
    print("\n🔒 Checking for security vulnerabilities...")
    try:
        # Try pip-audit if available
        result = subprocess.run(
            [sys.executable, "-m", "pip_audit", "--format=json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            vulnerabilities = json.loads(result.stdout)
            if vulnerabilities.get("vulnerabilities"):
                print(f"\n⚠️  Found {len(vulnerabilities['vulnerabilities'])} vulnerability(ies):")
                for vuln in vulnerabilities["vulnerabilities"]:
                    print(f"   - {vuln['name']}: {vuln.get('id', 'N/A')}")
                return vulnerabilities["vulnerabilities"]
            else:
                print("✅ No known security vulnerabilities!")
                return []
        else:
            print("ℹ️  pip-audit not installed. Install with: pip install pip-audit")
            return None
    except ImportError:
        print("ℹ️  pip-audit not installed. Install with: pip install pip-audit")
        return None
    except Exception as e:
        print(f"⚠️  Error checking security: {e}")
        return None

def check_discord_py_version():
    """Check current discord.py version"""
    try:
        import discord
        print(f"\n📦 Current discord.py version: {discord.__version__}")
        
        # Check if version is in safe range
        current = version.parse(discord.__version__)
        min_version = version.parse("2.3.0")
        max_version = version.parse("3.0.0")
        
        if min_version <= current < max_version:
            print("✅ Version is in safe range (2.3.0 - 3.0.0)")
        elif current >= max_version:
            print("⚠️  Version is 3.0.0 or higher - may have breaking changes!")
        else:
            print("⚠️  Version is below 2.3.0 - consider updating")
        
        return discord.__version__
    except ImportError:
        print("❌ discord.py not installed!")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def main():
    """Main function"""
    print("=" * 50)
    print("🔄 Update Check Script")
    print("=" * 50)
    
    # Check discord.py version
    check_discord_py_version()
    
    # Check outdated packages
    outdated = check_outdated()
    
    # Check security
    vulnerabilities = check_security()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Summary")
    print("=" * 50)
    
    if outdated:
        print(f"⚠️  {len(outdated)} package(s) can be updated")
        print("\n💡 To update safely:")
        print("   1. Test in development environment first")
        print("   2. Read changelog for breaking changes")
        print("   3. Update: pip install --upgrade <package>")
    
    if vulnerabilities:
        print(f"🔒 {len(vulnerabilities)} security vulnerability(ies) found")
        print("\n💡 To fix:")
        print("   pip install --upgrade <vulnerable-package>")
    
    if not outdated and not vulnerabilities:
        print("✅ Everything looks good!")
    
    print("\n📖 For update strategy, see: docs/UPDATE_STRATEGY.md")

if __name__ == "__main__":
    main()

