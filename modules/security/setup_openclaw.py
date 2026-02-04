#!/usr/bin/env python3
"""
OpenClaw Initialization Script
===============================

Sets up OpenClaw with:
- All configuration files
- Security monitoring
- Encrypted vault
- Directory structure
- Initial security scan

Usage:
    python3 setup_openclaw.py
    python3 setup_openclaw.py --enable-all
    python3 setup_openclaw.py --security-only
"""

import os
import sys
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
import argparse

class OpenClawSetup:
    """OpenClaw setup and initialization"""
    
    def __init__(self, base_dir: Path = None):
        self.base_dir = base_dir or Path.home() / ".openclaw"
        self.config_dir = self.base_dir / "config"
        self.logs_dir = self.base_dir / "logs"
        self.security_logs_dir = self.logs_dir / "security"
        self.data_dir = self.base_dir / "data"
        self.cache_dir = self.base_dir / "cache"
        self.plugins_dir = self.base_dir / "plugins"
        self.backups_dir = self.base_dir / "backups"
        self.reports_dir = self.base_dir / "reports" / "security"
    
    def create_directory_structure(self):
        """Create all required directories"""
        print("📁 Creating directory structure...")
        
        directories = [
            self.base_dir,
            self.config_dir,
            self.logs_dir,
            self.security_logs_dir,
            self.data_dir,
            self.cache_dir,
            self.plugins_dir,
            self.backups_dir,
            self.reports_dir,
            self.base_dir / "modules",
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            # Set restrictive permissions
            os.chmod(directory, 0o700)
            print(f"  ✅ Created: {directory}")
    
    def install_config_files(self):
        """Install configuration files"""
        print("\n⚙️  Installing configuration files...")
        
        # Check if config files exist in current directory
        config_files = [
            "openclaw-config.json",
            "security-config.json"
        ]
        
        for config_file in config_files:
            source = Path(config_file)
            dest = self.config_dir / config_file
            
            if source.exists():
                shutil.copy2(source, dest)
                os.chmod(dest, 0o600)
                print(f"  ✅ Installed: {config_file}")
            else:
                print(f"  ⚠️  Not found: {config_file} (will create default)")
                self._create_default_config(dest, config_file)
    
    def _create_default_config(self, dest: Path, config_type: str):
        """Create default configuration"""
        if config_type == "openclaw-config.json":
            config = {
                "version": "1.0.0",
                "core": {
                    "installation_path": str(self.base_dir),
                    "data_directory": str(self.data_dir),
                    "logs_directory": str(self.logs_dir)
                },
                "security": {
                    "enabled": True,
                    "audit_logging": True
                }
            }
        else:
            config = {
                "security_config_version": "1.0.0",
                "vulnerability_scanning": {"enabled": True},
                "audit_logging": {"enabled": True}
            }
        
        with open(dest, 'w') as f:
            json.dump(config, f, indent=2)
        
        os.chmod(dest, 0o600)
    
    def install_security_modules(self):
        """Install security modules"""
        print("\n🔒 Installing security modules...")
        
        modules = [
            "migrate_credentials.py",
            "secure_config.py",
            "secure_file_access.py",
            "security_monitor.py"
        ]
        
        modules_installed = 0
        
        for module in modules:
            source = Path(module)
            dest = self.base_dir / "modules" / module
            
            if source.exists():
                shutil.copy2(source, dest)
                os.chmod(dest, 0o700)
                print(f"  ✅ Installed: {module}")
                modules_installed += 1
            else:
                print(f"  ⚠️  Not found: {module}")
        
        if modules_installed > 0:
            print(f"\n  ✅ Installed {modules_installed} security modules")
    
    def install_integration_modules(self):
        """Install AXIS integration modules"""
        print("\n🚀 Installing integration modules...")
        
        modules_dir = Path("openclaw-modules")
        if not modules_dir.exists():
            print("  ⚠️  openclaw-modules directory not found")
            return
        
        dest_dir = self.base_dir / "modules"
        
        for module_file in modules_dir.glob("*.py"):
            dest = dest_dir / module_file.name
            shutil.copy2(module_file, dest)
            os.chmod(dest, 0o700)
            print(f"  ✅ Installed: {module_file.name}")
    
    def install_dependencies(self):
        """Install required Python packages"""
        print("\n📦 Installing dependencies...")
        
        dependencies = [
            "keyring",
            "cryptography",
            "safety"
        ]
        
        for package in dependencies:
            try:
                print(f"  Installing {package}...")
                subprocess.run([
                    sys.executable, "-m", "pip", "install",
                    package, "--break-system-packages", "-q"
                ], check=True, capture_output=True)
                print(f"  ✅ Installed: {package}")
            except subprocess.CalledProcessError as e:
                print(f"  ⚠️  Failed to install {package}: {e}")
    
    def run_initial_security_scan(self):
        """Run initial security scan"""
        print("\n🔍 Running initial security scan...")
        
        security_monitor = self.base_dir / "modules" / "security_monitor.py"
        
        if security_monitor.exists():
            try:
                result = subprocess.run([
                    sys.executable, str(security_monitor), "--report"
                ], capture_output=True, text=True, timeout=60)
                
                if result.returncode == 0:
                    print("  ✅ Security scan completed")
                    # Print last few lines of output
                    lines = result.stdout.split('\n')
                    for line in lines[-10:]:
                        if line.strip():
                            print(f"     {line}")
                else:
                    print(f"  ⚠️  Security scan had issues")
            
            except subprocess.TimeoutExpired:
                print("  ⚠️  Security scan timed out")
            except Exception as e:
                print(f"  ⚠️  Security scan failed: {e}")
        else:
            print("  ⚠️  Security monitor not found, skipping scan")
    
    def create_initialization_log(self):
        """Create log of initialization"""
        log_file = self.logs_dir / "initialization.log"
        
        log_data = {
            "initialized_at": datetime.now().isoformat(),
            "base_directory": str(self.base_dir),
            "python_version": sys.version,
            "platform": sys.platform
        }
        
        with open(log_file, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        print(f"\n📝 Initialization log: {log_file}")
    
    def print_next_steps(self):
        """Print next steps for user"""
        print("\n" + "=" * 70)
        print("🎉 OpenClaw Initialized Successfully!")
        print("=" * 70)
        
        print(f"\nInstallation directory: {self.base_dir}")
        
        print("\n📋 Next Steps:")
        print("\n1. Migrate credentials to secure storage:")
        print(f"   python3 {self.base_dir}/modules/migrate_credentials.py")
        
        print("\n2. Configure your API keys:")
        print("   python3 -c \"")
        print("   from secure_config import set_credential")
        print("   set_credential('anthropic_api_key', 'your-key-here')")
        print("   \"")
        
        print("\n3. Run security check:")
        print(f"   python3 {self.base_dir}/modules/security_monitor.py --report")
        
        print("\n4. Review configuration:")
        print(f"   cat {self.config_dir}/openclaw-config.json")
        
        print("\n5. Start using OpenClaw with enhanced security!")
        
        print("\n📚 Documentation:")
        print("   - Security Hardening: OPENCLAW-SECURITY-HARDENING.md")
        print("   - Integration Guide: AXIS-INTEGRATION-GUIDE.md")
        
        print("\n" + "=" * 70)
    
    def run_full_setup(self, enable_all: bool = False, security_only: bool = False):
        """Run complete setup"""
        print("=" * 70)
        print("OpenClaw Setup & Initialization")
        print("=" * 70)
        print()
        
        # Always create directory structure
        self.create_directory_structure()
        
        # Always install configs
        self.install_config_files()
        
        if not security_only:
            # Install all modules
            self.install_security_modules()
            self.install_integration_modules()
        else:
            # Only security modules
            self.install_security_modules()
        
        if enable_all:
            # Install dependencies
            self.install_dependencies()
        
        # Always run security scan
        self.run_initial_security_scan()
        
        # Create log
        self.create_initialization_log()
        
        # Print next steps
        self.print_next_steps()


def main():
    parser = argparse.ArgumentParser(description="OpenClaw Setup")
    parser.add_argument("--enable-all", action="store_true",
                       help="Enable all features and install dependencies")
    parser.add_argument("--security-only", action="store_true",
                       help="Install only security features")
    parser.add_argument("--base-dir", type=Path,
                       help="Custom base directory (default: ~/.openclaw)")
    
    args = parser.parse_args()
    
    setup = OpenClawSetup(base_dir=args.base_dir)
    setup.run_full_setup(
        enable_all=args.enable_all,
        security_only=args.security_only
    )

if __name__ == "__main__":
    main()
