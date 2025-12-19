# Deployment Guide untuk VPS 🚀

Panduan lengkap untuk deploy bot satpam ke VPS (Alibaba Cloud, AWS, dll).

## 📋 Prerequisites

- VPS dengan OS Linux (Ubuntu 20.04+ recommended)
- Python 3.8+ terinstall
- SSH access ke VPS
- Domain/IP untuk VPS

## 🔧 Setup VPS

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Python & Dependencies

```bash
# Install Python 3.10+
sudo apt install python3.10 python3.10-venv python3-pip -y

# Install FFmpeg (untuk music)
sudo apt install ffmpeg -y

# Install Git (jika belum)
sudo apt install git -y
```

### 3. Clone/Upload Project

```bash
# Option 1: Clone dari Git
git clone <your-repo-url> satpam-bot
cd satpam-bot

# Option 2: Upload via SCP
# scp -r satpam/ user@vps-ip:/home/user/satpam-bot
```

### 4. Setup Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install optional dependencies untuk music
pip install yt-dlp PyNaCl spotipy
```

### 5. Setup Config

```bash
# Copy config example
cp config.json.example config.json

# Edit config
nano config.json
# Atau gunakan editor lain: vim, code, dll
```

**Isi config.json:**
- Bot tokens (5 tokens)
- Role IDs (donatur, loyalist)
- Idle channel ID
- Music enabled bot number
- Spotify credentials (optional)

### 6. Run Startup Checks

```bash
# Check semua dependencies dan config
python startup_check.py
```

Pastikan semua checks **PASS** sebelum lanjut.

## 🚀 Running Bot

### Option 1: Direct Run (Testing)

```bash
# Activate venv
source venv/bin/activate

# Run bot
python run_multi.py
```

### Option 2: Screen (Recommended untuk testing)

```bash
# Install screen
sudo apt install screen -y

# Create screen session
screen -S satpam-bot

# Activate venv dan run
source venv/bin/activate
python run_multi.py

# Detach: Ctrl+A, lalu D
# Reattach: screen -r satpam-bot
```

### Option 3: Systemd Service (Production)

```bash
# Create service file
sudo nano /etc/systemd/system/satpam-bot.service
```

**Isi file:**
```ini
[Unit]
Description=Satpam Discord Bot
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/satpam-bot
Environment="PATH=/home/your-username/satpam-bot/venv/bin"
ExecStart=/home/your-username/satpam-bot/venv/bin/python run_multi.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable dan start:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable satpam-bot

# Start service
sudo systemctl start satpam-bot

# Check status
sudo systemctl status satpam-bot

# View logs
sudo journalctl -u satpam-bot -f
```

## 📊 Monitoring

### Check Bot Status

```bash
# Check if bot is running
ps aux | grep python

# Check logs
tail -f logs/bot_$(date +%Y%m%d).log

# Check systemd logs
sudo journalctl -u satpam-bot -n 50
```

### Resource Monitoring

```bash
# Check RAM usage
free -h

# Check CPU usage
top
# atau
htop

# Check disk usage
df -h
```

## 🔄 Updates

### Update Bot Code

```bash
# Stop bot
sudo systemctl stop satpam-bot
# atau
screen -X -S satpam-bot quit

# Pull updates
git pull
# atau upload new files

# Update dependencies
source venv/bin/activate
pip install -r requirements.txt --upgrade

# Run checks
python startup_check.py

# Start bot
sudo systemctl start satpam-bot
# atau
screen -S satpam-bot
source venv/bin/activate
python run_multi.py
```

## 🛠️ Troubleshooting

### Bot tidak start

```bash
# Check config
python startup_check.py

# Check logs
tail -f logs/bot_*.log

# Check systemd status
sudo systemctl status satpam-bot
```

### Bot crash/restart loop

```bash
# Check error logs
sudo journalctl -u satpam-bot -n 100

# Check resource usage
free -h
top

# Check disk space
df -h
```

### Music tidak bekerja

```bash
# Check FFmpeg
ffmpeg -version

# Check yt-dlp
pip show yt-dlp

# Check Spotify API (jika digunakan)
# Pastikan credentials sudah di-set di config.json
```

### Permission errors

```bash
# Fix permissions
chmod +x run_multi.py
chmod -R 755 logs/
chmod -R 755 backups/
```

## 🔒 Security

### Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### File Permissions

```bash
# Protect config.json
chmod 600 config.json

# Protect .env (jika ada)
chmod 600 .env
```

## 📝 Maintenance

### Daily Tasks

- Check logs untuk errors
- Monitor resource usage
- Backup config.json

### Weekly Tasks

- Review logs
- Check disk space
- Update dependencies (optional)

### Monthly Tasks

- Clean old logs (keep last 30 days)
- Clean old backups (keep last 10)
- Review and optimize

## 🎯 Best Practices

1. **Always use virtual environment**
2. **Run startup checks sebelum deploy**
3. **Monitor logs regularly**
4. **Backup config.json**
5. **Use systemd untuk production**
6. **Set up log rotation**
7. **Monitor resource usage**

## 📞 Support

Jika ada masalah:
1. Check logs: `logs/bot_*.log`
2. Run startup checks: `python startup_check.py`
3. Check systemd status: `sudo systemctl status satpam-bot`

---

**Happy deploying!** 🚀

