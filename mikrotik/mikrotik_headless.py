#!/usr/bin/env python3
"""
MikroTik Master Scraper - Headless/CLI Mode

Allows running the MikroTik scraper as a daemon via SSH with full control from terminal.

Usage:
    python mikrotik_headless.py --help                          # Show help
    python mikrotik_headless.py --daemon start                  # Start daemon
    python mikrotik_headless.py --daemon stop                   # Stop daemon
    python mikrotik_headless.py --daemon status                 # Check status
    python mikrotik_headless.py --scan-version 6.51             # Scan specific version
    python mikrotik_headless.py --output /path/to/archive       # Set output directory
    python mikrotik_headless.py --workers 8 --retries 3         # Set worker/retry count
    python mikrotik_headless.py --check-rss                     # Check RSS for new versions
"""

import os
import sys
import argparse
import json
import time
import signal
import threading
from pathlib import Path
from datetime import datetime

# Import the engine from the main script
sys.path.insert(0, str(Path(__file__).parent))
from mikrotik_master import MasterEngine


class HeadlessLogger:
    """Simple logger for headless mode"""
    def __init__(self, log_file=None):
        self.log_file = log_file
        
    def log(self, message, level='INFO'):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_msg = f"[{timestamp}] [{level}] {message}"
        print(log_msg)
        if self.log_file:
            try:
                with open(self.log_file, 'a') as f:
                    f.write(log_msg + '\n')
            except Exception as e:
                print(f"[ERROR] Failed to write to log: {e}")


class HeadlessController:
    """Controls MikroTik scraper in headless mode"""
    
    def __init__(self, output_dir, workers=8, retries=3, log_file=None):
        self.output_dir = Path(output_dir)
        self.workers = workers
        self.retries = retries
        self.logger = HeadlessLogger(log_file)
        
        # Create a wrapper GUI-like object for the engine
        self.gui_wrapper = self._create_gui_wrapper()
        self.engine = MasterEngine(
            output_dir=str(self.output_dir),
            download_workers=self.workers,
            max_retries=self.retries,
            gui=self.gui_wrapper
        )
        
        # Daemon control
        self.daemon_running = False
        self.daemon_thread = None
        self.daemon_pid_file = self.output_dir / '.daemon.pid'
        self.daemon_stop_event = threading.Event()
        
    def _create_gui_wrapper(self):
        """Create a minimal GUI-like wrapper for the engine"""
        class GUIWrapper:
            def __init__(self, logger):
                self.logger = logger
                self.stats = {}
                self.stats_lock = threading.Lock()
                
            def log(self, message, level='INFO'):
                self.logger.log(message, level)
        
        return GUIWrapper(self.logger)
    
    def log(self, message, level='INFO'):
        self.logger.log(message, level)
    
    def scan_version(self, version):
        """Scan a specific version"""
        self.log(f"Scanning version {version}...", 'INFO')
        try:
            self.engine.process_version(version)
            self.engine.save_found_versions()
            self.engine.save_stats()
            self.log(f"Successfully processed version {version}", 'INFO')
            return True
        except Exception as e:
            self.log(f"Failed to scan version {version}: {e}", 'ERROR')
            return False
    
    def check_rss(self):
        """Check RSS for new versions"""
        self.log("Checking RSS for new versions...", 'INFO')
        try:
            new_versions = self.engine.scan_rss_for_versions()
            if new_versions:
                self.log(f"Found {len(new_versions)} new versions: {', '.join(new_versions)}", 'INFO')
                for version in new_versions:
                    self.log(f"Downloading version {version}...", 'INFO')
                    self.engine.process_version(version)
                self.engine.save_found_versions()
                self.engine.save_stats()
                self.log("RSS check completed successfully", 'INFO')
            else:
                self.log("No new versions found in RSS", 'INFO')
            return True
        except Exception as e:
            self.log(f"Failed to check RSS: {e}", 'ERROR')
            return False
    
    def start_daemon(self, interval_minutes=15):
        """Start daemon mode"""
        if self.daemon_running:
            self.log("Daemon is already running", 'WARNING')
            return False
        
        # Write PID file
        try:
            with open(self.daemon_pid_file, 'w') as f:
                f.write(str(os.getpid()))
        except Exception as e:
            self.log(f"Failed to write PID file: {e}", 'ERROR')
        
        self.daemon_running = True
        self.daemon_stop_event.clear()
        self.daemon_thread = threading.Thread(
            target=self._daemon_loop,
            args=(interval_minutes,),
            daemon=False
        )
        self.daemon_thread.start()
        self.log(f"Daemon started (checking RSS every {interval_minutes} minutes)", 'INFO')
        return True
    
    def _daemon_loop(self, interval_minutes):
        """Main daemon loop"""
        while self.daemon_running:
            try:
                self.check_rss()
            except Exception as e:
                self.log(f"Daemon loop error: {e}", 'ERROR')
            
            # Sleep in small chunks so stop signal is responsive
            sleep_interval = interval_minutes * 60
            sleep_chunk = 5
            for _ in range(sleep_interval // sleep_chunk):
                if self.daemon_stop_event.is_set():
                    break
                time.sleep(sleep_chunk)
    
    def stop_daemon(self):
        """Stop daemon mode"""
        if not self.daemon_running:
            self.log("Daemon is not running", 'WARNING')
            return False
        
        self.log("Stopping daemon...", 'INFO')
        self.daemon_running = False
        self.daemon_stop_event.set()
        
        if self.daemon_thread:
            self.daemon_thread.join(timeout=5)
        
        # Remove PID file
        try:
            if self.daemon_pid_file.exists():
                self.daemon_pid_file.unlink()
        except Exception as e:
            self.log(f"Failed to remove PID file: {e}", 'ERROR')
        
        self.log("Daemon stopped", 'INFO')
        return True
    
    def get_daemon_status(self):
        """Check daemon status"""
        if self.daemon_pid_file.exists():
            try:
                with open(self.daemon_pid_file, 'r') as f:
                    pid = f.read().strip()
                    # Check if process exists
                    try:
                        os.kill(int(pid), 0)  # Signal 0 doesn't kill, just checks
                        self.log(f"Daemon is running (PID: {pid})", 'INFO')
                        return True
                    except OSError:
                        self.log("Daemon PID file exists but process not running", 'WARNING')
                        self.daemon_pid_file.unlink()
                        return False
            except Exception as e:
                self.log(f"Failed to check daemon status: {e}", 'ERROR')
                return False
        else:
            self.log("Daemon is not running", 'INFO')
            return False
    
    def show_stats(self):
        """Display statistics"""
        stats_file = self.output_dir / 'download_stats.json'
        if stats_file.exists():
            try:
                with open(stats_file, 'r') as f:
                    stats = json.load(f)
                    self.log("=== Download Statistics ===", 'INFO')
                    for key, value in stats.items():
                        if key == 'bytes_downloaded':
                            gb = value / (1024**3)
                            self.log(f"  {key}: {gb:.2f} GB", 'INFO')
                        else:
                            self.log(f"  {key}: {value}", 'INFO')
                    return True
            except Exception as e:
                self.log(f"Failed to read stats: {e}", 'ERROR')
                return False
        else:
            self.log("No stats file found", 'INFO')
            return False
    

    def check_existing_files(self):
        """Check what files are already downloaded and report them"""
        self.log("=== Checking Existing Downloads ===", 'INFO')
        archive_path = Path(self.output_dir)
        
        if not archive_path.exists():
            self.log("No archive directory found - starting fresh", 'INFO')
            return 0
        
        total_files = 0
        total_size = 0
        versions_found = set()
        
        for version_dir in archive_path.glob('*'):
            if version_dir.is_dir() and version_dir.name != '__pycache__':
                versions_found.add(version_dir.name)
                for arch_dir in version_dir.glob('*'):
                    if arch_dir.is_dir():
                        for file in arch_dir.glob('*'):
                            if file.is_file():
                                total_files += 1
                                total_size += file.stat().st_size
        
        if total_files > 0:
            size_gb = total_size / (1024**3)
            self.log(f"Found {total_files} files already downloaded ({size_gb:.2f} GB)", 'INFO')
            self.log(f"Versions already have: {', '.join(sorted(versions_found))}", 'INFO')
            self.log("Resuming scan - will skip existing files...", 'INFO')
        else:
            self.log("No files downloaded yet - starting fresh", 'INFO')
        
        return total_files

    def full_scan(self):
        """Execute a full scan of all available MikroTik versions with parallel download"""
        from concurrent.futures import ThreadPoolExecutor, as_completed
        from pathlib import Path
        
        self.log("=== Starting Full Scan of All Available Versions ===", 'INFO')
        self.check_existing_files()
        self.log(f"Output directory: {self.output_dir}", 'INFO')
        self.log(f"Download workers: {self.workers}", 'INFO')
        self.log("Scanning versions 3.30.1 to 7.20.x with PARALLEL downloads...", 'INFO')
        self.log("As versions are found, they'll start downloading immediately", 'INFO')
        
        # Generate all candidate versions
        start_parts = '3.30.1'.split('.')
        end_parts = '7.20'.split('.')
        start_major = int(start_parts[0])
        start_minor = int(start_parts[1]) if len(start_parts) > 1 else 0
        end_major = int(end_parts[0])
        end_minor = int(end_parts[1]) if len(end_parts) > 1 else 50
        
        all_versions = self.engine.generate_all_version_numbers(start_major, start_minor, end_major, end_minor)
        self.log(f"Generated {len(all_versions)} candidate versions", 'INFO')
        
        # Check versions and download as we find them (parallel)
        found_count = 0
        with ThreadPoolExecutor(max_workers=self.workers) as executor:
            futures = {executor.submit(self.engine.check_version_exists, v): v for v in all_versions}
            
            for fut in as_completed(futures):
                v = futures[fut]
                try:
                    if fut.result():
                        found_count += 1
                        self.log(f"Found version: {v} - Starting download...", 'FOUND')
                        # Download immediately in background
                        executor.submit(self.engine.process_version, v)
                except Exception:
                    pass
        
        self.log(f"Scan complete - Found and downloaded {found_count} versions", 'SUCCESS')
        self.engine.save_found_versions()
        self.engine.save_stats()

    def show_versions(self):
        """Display found versions"""
        versions_file = self.output_dir / 'found_versions.json'
        if versions_file.exists():
            try:
                with open(versions_file, 'r') as f:
                    data = json.load(f)
                    versions = sorted(data.get('versions', []))
                    self.log(f"=== Found Versions ({len(versions)} total) ===", 'INFO')
                    for v in versions:
                        self.log(f"  {v}", 'INFO')
                    return True
            except Exception as e:
                self.log(f"Failed to read versions: {e}", 'ERROR')
                return False
        else:
            self.log("No versions file found", 'INFO')
            return False


def main():
    parser = argparse.ArgumentParser(
        description='MikroTik Master Scraper - Headless/CLI Mode',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python mikrotik_headless.py --daemon start
  python mikrotik_headless.py --daemon stop
  python mikrotik_headless.py --daemon status
  python mikrotik_headless.py --scan-version 6.51
  python mikrotik_headless.py --check-rss
  python mikrotik_headless.py --stats
  python mikrotik_headless.py --full-scan
  python mikrotik_headless.py --list-versions
  python mikrotik_headless.py --output /opt/mikrotik --workers 4 --daemon start
        '''
    )
    
    parser.add_argument('--output', type=str, default='./mikrotik_archive',
                       help='Output directory for downloads (default: ./mikrotik_archive)')
    parser.add_argument('--workers', type=int, default=8,
                       help='Number of download workers (default: 8)')
    parser.add_argument('--retries', type=int, default=3,
                       help='Maximum retries per file (default: 3)')
    parser.add_argument('--log-file', type=str, default=None,
                       help='Log file path (optional)')
    
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--daemon', choices=['start', 'stop', 'status'],
                      help='Daemon control')
    group.add_argument('--scan-version', type=str,
                      help='Scan a specific version (e.g., 6.51)')
    group.add_argument('--check-rss', action='store_true',
                      help='Check RSS for new versions')
    group.add_argument('--stats', action='store_true',
                      help='Display statistics')
    group.add_argument('--list-versions', action='store_true',
                      help='List all found versions')
    
    group.add_argument('--full-scan', action='store_true',
                      help='Perform a complete scan of all available versions')

    group.add_argument('--check-existing', action='store_true',
                      help='Check and report existing downloads, then resume')

    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    output_path = Path(args.output)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Set up logging
    log_file = args.log_file
    if not log_file:
        log_file = str(output_path / 'headless.log')
    
    controller = HeadlessController(
        output_dir=args.output,
        workers=args.workers,
        retries=args.retries,
        log_file=log_file
    )
    

    # Apply night-mode settings
    if args.night_mode:
        args.workers = 2
        args.delay = 2.0
        controller.logger.log("[NIGHT MODE] Workers: 2, Delay: 2s between downloads", 'INFO')
    elif args.delay > 0:
        controller.logger.log(f"Download delay: {args.delay}s between files", 'INFO')
    # Handle daemon commands
    if args.daemon:
        if args.daemon == 'start':
            controller.start_daemon(interval_minutes=15)
            # Keep the main thread alive
            try:
                while controller.daemon_running:
                    time.sleep(1)
            except KeyboardInterrupt:
                controller.log("Keyboard interrupt received", 'INFO')
                controller.stop_daemon()
        elif args.daemon == 'stop':
            controller.stop_daemon()
        elif args.daemon == 'status':
            controller.get_daemon_status()
    
    # Handle one-off commands
    elif args.scan_version:
        controller.scan_version(args.scan_version)
    elif args.check_rss:
        controller.check_rss()
    elif args.stats:
        controller.show_stats()
    elif args.list_versions:
        controller.show_versions()
    elif args.check_existing:
        controller.check_existing_files()

    elif args.full_scan:
        controller.full_scan()

    else:
        parser.print_help()


if __name__ == '__main__':
    main()














