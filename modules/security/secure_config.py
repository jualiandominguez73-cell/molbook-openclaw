"""
Secure Configuration Module for OpenClaw
=========================================

Provides secure access to credentials via OS keychain instead of plaintext files.

Usage:
    from secure_config import SecureConfig
    
    config = SecureConfig()
    api_key = config.get('anthropic_api_key')
"""

import keyring
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Service name for keyring
SERVICE_NAME = "OpenClaw"

# Default config path
DEFAULT_CONFIG_PATH = Path.home() / ".openclaw" / "config.json"

class SecureConfig:
    """
    Secure configuration manager
    
    Credentials stored in OS keychain, other config in JSON file
    """
    
    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize secure configuration
        
        Args:
            config_path: Path to non-sensitive config file
        """
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self._config_cache: Optional[Dict[str, Any]] = None
    
    def _load_config_file(self) -> Dict[str, Any]:
        """Load non-sensitive configuration from file"""
        if not self.config_path.exists():
            logger.warning(f"Config file not found: {self.config_path}")
            return {}
        
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return {}
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value
        
        First checks OS keychain for credentials, then config file for other settings
        
        Args:
            key: Configuration key
            default: Default value if not found
            
        Returns:
            Configuration value or default
        """
        # Try to get from keychain first (for credentials)
        try:
            value = keyring.get_password(SERVICE_NAME, key)
            if value is not None:
                return value
        except Exception as e:
            logger.debug(f"Keychain lookup failed for {key}: {e}")
        
        # Fall back to config file
        if self._config_cache is None:
            self._config_cache = self._load_config_file()
        
        return self._config_cache.get(key, default)
    
    def set_credential(self, key: str, value: str) -> bool:
        """
        Store credential securely in OS keychain
        
        Args:
            key: Credential key
            value: Credential value
            
        Returns:
            True if successful, False otherwise
        """
        try:
            keyring.set_password(SERVICE_NAME, key, value)
            logger.info(f"Credential stored: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to store credential {key}: {e}")
            return False
    
    def delete_credential(self, key: str) -> bool:
        """
        Delete credential from OS keychain
        
        Args:
            key: Credential key to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            keyring.delete_password(SERVICE_NAME, key)
            logger.info(f"Credential deleted: {key}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete credential {key}: {e}")
            return False
    
    def list_credentials(self) -> list:
        """
        List all credential keys stored in keychain
        
        Note: This is keyring-backend dependent and may not work on all systems
        
        Returns:
            List of credential keys
        """
        # This is implementation-specific and may not work on all backends
        # Return empty list if not supported
        logger.warning("list_credentials() may not be supported on all keyring backends")
        return []
    
    def get_all_config(self) -> Dict[str, Any]:
        """
        Get all non-sensitive configuration
        
        Does NOT include credentials from keychain
        
        Returns:
            Dictionary of configuration settings
        """
        if self._config_cache is None:
            self._config_cache = self._load_config_file()
        
        return self._config_cache.copy()
    
    def save_config(self, config: Dict[str, Any], exclude_credentials: bool = True) -> bool:
        """
        Save configuration to file
        
        Args:
            config: Configuration dictionary
            exclude_credentials: If True, excludes credential keys before saving
            
        Returns:
            True if successful, False otherwise
        """
        if exclude_credentials:
            # List of keys that should be in keychain, not config file
            credential_keys = {
                'anthropic_api_key', 'openai_api_key', 'github_token',
                'slack_token', 'discord_token', 'telegram_token',
                'database_password', 'encryption_key', 'jwt_secret',
                'api_token', 'password', 'secret_key'
            }
            
            # Remove credential keys
            config = {k: v for k, v in config.items() 
                     if k not in credential_keys and not k.endswith('_token') 
                     and not k.endswith('_key') and not k.endswith('_password')}
        
        try:
            # Create backup
            if self.config_path.exists():
                backup_path = self.config_path.with_suffix('.json.backup')
                with open(self.config_path, 'r') as f_src:
                    with open(backup_path, 'w') as f_dst:
                        f_dst.write(f_src.read())
            
            # Save new config
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            # Set restrictive permissions
            os.chmod(self.config_path, 0o600)
            
            # Update cache
            self._config_cache = config
            
            logger.info(f"Configuration saved to {self.config_path}")
            return True
        
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
            return False
    
    def verify_credentials(self) -> Dict[str, bool]:
        """
        Verify that required credentials are present
        
        Returns:
            Dictionary mapping credential names to availability status
        """
        required_credentials = [
            'anthropic_api_key',
            'openai_api_key',
        ]
        
        status = {}
        for cred in required_credentials:
            value = self.get(cred)
            status[cred] = bool(value and value.strip())
        
        return status


class EnvironmentConfig(SecureConfig):
    """
    Extended config that also checks environment variables
    
    Priority order:
    1. Environment variables
    2. OS keychain
    3. Config file
    """
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value with environment variable priority
        
        Args:
            key: Configuration key
            default: Default value if not found
            
        Returns:
            Configuration value or default
        """
        # Check environment variables first (uppercase)
        env_key = f"OPENCLAW_{key.upper()}"
        env_value = os.environ.get(env_key)
        if env_value is not None:
            return env_value
        
        # Fall back to parent class (keychain -> config file)
        return super().get(key, default)


# Global instance for convenience
_global_config: Optional[SecureConfig] = None

def get_config() -> SecureConfig:
    """Get global configuration instance"""
    global _global_config
    if _global_config is None:
        _global_config = SecureConfig()
    return _global_config

def get(key: str, default: Any = None) -> Any:
    """Convenience function to get config value"""
    return get_config().get(key, default)

def set_credential(key: str, value: str) -> bool:
    """Convenience function to set credential"""
    return get_config().set_credential(key, value)


# Example usage
if __name__ == "__main__":
    import sys
    
    # Test secure config
    config = SecureConfig()
    
    # Try to get API key
    api_key = config.get('anthropic_api_key')
    
    if api_key:
        # Mask for display
        masked = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
        print(f"✅ Found Anthropic API key: {masked}")
    else:
        print("❌ Anthropic API key not found")
        print("\nTo set it:")
        print("  python3 migrate_credentials.py")
        print("  OR")
        print("  python3 -c \"")
        print("  from secure_config import set_credential")
        print("  set_credential('anthropic_api_key', 'your-key-here')")
        print("  \"")
    
    # Verify all required credentials
    print("\nCredential status:")
    status = config.verify_credentials()
    for cred, present in status.items():
        status_icon = "✅" if present else "❌"
        print(f"  {status_icon} {cred}")
    
    sys.exit(0 if all(status.values()) else 1)
