"""
Script untuk run multiple bot satpam sekaligus
Gunakan ini jika kamu punya multiple bot accounts
"""
import asyncio
import sys
import signal

    # Import startup checks
try:
    from utils.startup_check import run_all_checks
    RUN_CHECKS = True
except ImportError:
    RUN_CHECKS = False

def signal_handler(sig, frame):
    """Handle shutdown signals"""
    print("\n\n👋 Received shutdown signal. Shutting down gracefully...")
    sys.exit(0)

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    print("=" * 50)
    print("🛡️  SATPAM BOT - MULTIPLE INSTANCES")
    print("=" * 50)
    print()
    
    # Run startup checks
    if RUN_CHECKS:
        if not run_all_checks():
            print("\n❌ Startup checks failed. Exiting...")
            sys.exit(1)
        print()
    
    # Import after checks
    from bot.bot_multi import main
    from utils.logger import get_logger
    
    logger = get_logger('main')
    
    try:
        logger.info("Starting bot instances...")
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt. Shutting down...")
        print("\n\n👋 Shutting down all bots...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        print(f"\n❌ Fatal Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

