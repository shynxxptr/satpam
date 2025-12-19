# Resource Monitoring Guide 📊

Panduan untuk monitor resource usage bot di Alibaba Cloud 1GB RAM.

## 🔍 Monitoring Tools

### 1. Built-in Monitoring (Python)
```python
import psutil
import asyncio

async def monitor_resources():
    while True:
        ram = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        
        print(f"RAM: {ram.percent}% ({ram.used/1024/1024:.0f}MB / {ram.total/1024/1024:.0f}MB)")
        print(f"CPU: {cpu}%")
        
        if ram.percent > 80:
            print("⚠️  WARNING: RAM usage high!")
        
        await asyncio.sleep(60)  # Check every minute
```

### 2. Alibaba Cloud Monitoring
- Use CloudMonitor dashboard
- Set alerts for RAM > 80%
- Set alerts for CPU > 90%

### 3. System Commands
```bash
# Check RAM
free -h

# Check CPU
top
htop

# Check processes
ps aux | grep python
```

## 📊 Expected Resource Usage

### Normal Operation (No Music)
- **RAM:** 300-400MB (5 bots idle)
- **CPU:** 1-5% (idle)
- **Network:** Minimal

### With 1 Music Stream
- **RAM:** 500-600MB
- **CPU:** 20-40% (during playback)
- **Network:** ~64kbps

### With All Bots Active
- **RAM:** 700-800MB ⚠️
- **CPU:** 30-50%
- **Network:** Moderate

## ⚠️ Warning Thresholds

- **RAM > 80%:** Warn admin, consider stopping music
- **RAM > 90%:** Auto-stop music, emergency mode
- **CPU > 80%:** Warn admin
- **CPU > 95%:** Auto-throttle

## 🛠️ Optimization Tips

1. **Restart bot daily** (clear memory leaks)
2. **Limit queue size** (prevent memory buildup)
3. **Clear cache regularly**
4. **Use swap space** (if available)
5. **Monitor and log** resource usage

