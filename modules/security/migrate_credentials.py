#!/usr/bin/env python3
"""
OpenClaw Credential Migration Script
=====================================

Migrates credentials from plaintext configuration files to OS-level secure storage.

Supports:
- macOS Keychain
- Windows Credential Manager
- Linux Secret Service (GNOME Keyring, KWallet)

Usage:
    python3 migrate_credentials.py [--dry-run] [--config-path PATH]

Options:
    --dry-run       Show what would be migrated without making changes
    --config-path   Path to config file (default: ~/.openclaw/config.json)
"""

import json
import keyring
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional

# Service name for keyring storage
SERVICE_NAME = "OpenClaw"

# Credentials to migrate (key name in config -> key name in keyring)
CREDENTIAL_MAPPINGS = {
    'anthropic_api_key': 'anthropic_api_key',
    'openai_api_key': 'openai_api_key',
    'github_token': 'github_token',
    'gitlab_token': 'gitlab_token',
    'slack_token': 'slack_token',
    'discord_token': 'discord_token',
    'telegram_token': 'telegram_token',
    'database_password': 'database_password',
    'encryption_key': 'encryption_key',
    'jwt_secret': 'jwt_secret',
}

class CredentialMigrator:
    """Handles migration of credentials to secure storage"""
    
    def __init__(self, config_path: Path, dry_run: bool = False):
        self.config_path = config_path
        self.dry_run = dry_run
        self.migrated: List[str] = []
        self.skipped: List[str] = []
        self.errors: List[str] = []
    
    def load_config(self) -> Optional[Dict]:
        """Load current configuration file"""
        if not self.config_path.exists():
            print(f"❌ Configuration file not found: {self.config_path}")
            return None
        
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in config file: {e}")
            return None
        except Exception as e:
            print(f"❌ Error reading config file: {e}")
            return None
    
    def save_config(self, config: Dict) -> bool:
        """Save updated configuration file"""
        if self.dry_run:
            print("  (Dry run: would save config)")
            return True
        
        try:
            # Create backup first
            backup_path = self.config_path.with_suffix('.json.backup')
            with open(self.config_path, 'r') as f_src:
                with open(backup_path, 'w') as f_dst:
                    f_dst.write(f_src.read())
            
            # Save updated config
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            # Set restrictive permissions (owner read/write only)
            os.chmod(self.config_path, 0o600)
            
            print(f"✅ Config saved and secured (backup: {backup_path})")
            return True
        
        except Exception as e:
            print(f"❌ Error saving config: {e}")
            return False
    
    def migrate_credential(self, key: str, value: str) -> bool:
        """Migrate a single credential to keyring"""
        if not value or value.strip() == "":
            self.skipped.append(key)
            return False
        
        try:
            if self.dry_run:
                print(f"  Would migrate: {key}")
                self.migrated.append(key)
                return True
            
            # Store in keyring
            keyring_key = CREDENTIAL_MAPPINGS.get(key, key)
            keyring.set_password(SERVICE_NAME, keyring_key, value)
            
            # Verify it was stored
            retrieved = keyring.get_password(SERVICE_NAME, keyring_key)
            if retrieved == value:
                self.migrated.append(key)
                print(f"  ✅ Migrated: {key}")
                return True
            else:
                self.errors.append(f"{key}: verification failed")
                print(f"  ❌ Failed to verify: {key}")
                return False
        
        except Exception as e:
            self.errors.append(f"{key}: {str(e)}")
            print(f"  ❌ Error migrating {key}: {e}")
            return False
    
    def check_keyring_availability(self) -> bool:
        """Check if keyring backend is available"""
        try:
            backend = keyring.get_keyring()
            print(f"🔑 Keyring backend: {backend.__class__.__name__}")
            
            # Test write and read
            test_key = "test_openclaw_migration"
            test_value = "test_value_12345"
            
            keyring.set_password(SERVICE_NAME, test_key, test_value)
            retrieved = keyring.get_password(SERVICE_NAME, test_key)
            
            # Clean up test
            try:
                keyring.delete_password(SERVICE_NAME, test_key)
            except:
                pass
            
            if retrieved == test_value:
                print("✅ Keyring is working correctly")
                return True
            else:
                print("❌ Keyring test failed: value mismatch")
                return False
        
        except Exception as e:
            print(f"❌ Keyring not available: {e}")
            print("\nTo fix this:")
            print("  macOS: Keychain should work by default")
            print("  Windows: pip install pywin32")
            print("  Linux: Install gnome-keyring or kwallet")
            return False
    
    def migrate_all(self) -> bool:
        """Migrate all credentials from config to keyring"""
        print("=" * 60)
        print("OpenClaw Credential Migration")
        print("=" * 60)
        print()
        
        if self.dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()
        
        # Check keyring availability
        if not self.check_keyring_availability():
            return False
        
        print()
        
        # Load config
        print(f"📁 Loading config from: {self.config_path}")
        config = self.load_config()
        if not config:
            return False
        
        print()
        print("🔐 Migrating credentials...")
        print()
        
        # Migrate each credential
        for config_key in CREDENTIAL_MAPPINGS.keys():
            if config_key in config:
                value = config[config_key]
                if self.migrate_credential(config_key, value):
                    # Remove from config if migration successful
                    if not self.dry_run:
                        del config[config_key]
        
        print()
        
        # Save updated config (without credentials)
        if self.migrated and not self.dry_run:
            print("💾 Saving updated configuration...")
            if not self.save_config(config):
                return False
        
        # Print summary
        print()
        print("=" * 60)
        print("Migration Summary")
        print("=" * 60)
        print(f"✅ Migrated: {len(self.migrated)} credentials")
        if self.migrated:
            for key in self.migrated:
                print(f"  • {key}")
        
        print(f"\n⏭️  Skipped: {len(self.skipped)} (empty or missing)")
        if self.skipped:
            for key in self.skipped:
                print(f"  • {key}")
        
        if self.errors:
            print(f"\n❌ Errors: {len(self.errors)}")
            for error in self.errors:
                print(f"  • {error}")
        
        print()
        
        if not self.dry_run:
            print("✅ Migration complete!")
            print()
            print("Next steps:")
            print("1. Update your OpenClaw code to use keyring:")
            print("   import keyring")
            print(f"   api_key = keyring.get_password('{SERVICE_NAME}', 'anthropic_api_key')")
            print("2. Test that OpenClaw still works with new credential storage")
            print("3. If successful, delete the backup: rm ~/.openclaw/config.json.backup")
        
        return len(self.errors) == 0

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Migrate OpenClaw credentials to secure storage"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be migrated without making changes'
    )
    parser.add_argument(
        '--config-path',
        type=Path,
        default=Path.home() / '.openclaw' / 'config.json',
        help='Path to config file (default: ~/.openclaw/config.json)'
    )
    
    args = parser.parse_args()
    
    migrator = CredentialMigrator(args.config_path, args.dry_run)
    success = migrator.migrate_all()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
