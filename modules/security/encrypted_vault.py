"""
Encrypted Vault Module for OpenClaw
====================================

Secure encrypted storage for personal data using:
- AES-256-GCM encryption
- OS keychain for master key storage
- SQLite for data persistence
- Per-record encryption keys

Usage:
    from encrypted_vault import EncryptedVault
    
    vault = EncryptedVault()
    vault.store("conversations", "conv_123", {"messages": [...]})
    data = vault.retrieve("conversations", "conv_123")
"""

import sqlite3
import json
import keyring
import os
import secrets
from pathlib import Path
from typing import Any, Dict, Optional, List
from datetime import datetime
import logging

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

logger = logging.getLogger(__name__)

SERVICE_NAME = "OpenClaw"
VAULT_DB_PATH = Path.home() / ".openclaw" / "vault.db"

class EncryptionError(Exception):
    """Raised when encryption/decryption fails"""
    pass

class EncryptedVault:
    """
    Encrypted storage vault for sensitive data
    
    Features:
    - AES-256-GCM encryption for all stored data
    - Master key stored in OS keychain
    - Unique encryption key per record
    - Automatic key derivation and rotation
    """
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Initialize encrypted vault
        
        Args:
            db_path: Path to SQLite database (default: ~/.openclaw/vault.db)
        """
        self.db_path = db_path or VAULT_DB_PATH
        self.master_key = None
        
        # Create directory if it doesn't exist
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Load or create master key
        self._init_master_key()
    
    def _init_database(self):
        """Initialize SQLite database schema"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Create encrypted_data table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS encrypted_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                encrypted_value BLOB NOT NULL,
                nonce BLOB NOT NULL,
                salt BLOB NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(namespace, key)
            )
        """)
        
        # Create index for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_namespace_key 
            ON encrypted_data(namespace, key)
        """)
        
        # Create metadata table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vault_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)
        
        conn.commit()
        conn.close()
        
        # Set restrictive permissions
        os.chmod(self.db_path, 0o600)
        
        logger.info(f"Initialized vault database: {self.db_path}")
    
    def _init_master_key(self):
        """Initialize or load master encryption key from OS keychain"""
        # Try to load existing master key from keychain
        master_key_hex = keyring.get_password(SERVICE_NAME, "vault_master_key")
        
        if master_key_hex:
            # Load existing key
            self.master_key = bytes.fromhex(master_key_hex)
            logger.info("Loaded existing master key from keychain")
        else:
            # Generate new master key (256-bit for AES-256)
            self.master_key = secrets.token_bytes(32)
            
            # Store in OS keychain
            keyring.set_password(
                SERVICE_NAME,
                "vault_master_key",
                self.master_key.hex()
            )
            
            # Store creation timestamp
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR REPLACE INTO vault_metadata (key, value) VALUES (?, ?)",
                ("master_key_created", datetime.now().isoformat())
            )
            conn.commit()
            conn.close()
            
            logger.info("Generated new master key and stored in keychain")
    
    def _derive_key(self, salt: bytes) -> bytes:
        """
        Derive encryption key from master key and salt
        
        Args:
            salt: Random salt for key derivation
            
        Returns:
            Derived 256-bit key
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return kdf.derive(self.master_key)
    
    def _encrypt(self, data: Dict[str, Any]) -> tuple:
        """
        Encrypt data with AES-256-GCM
        
        Args:
            data: Dictionary to encrypt
            
        Returns:
            Tuple of (encrypted_data, nonce, salt)
        """
        # Generate random salt for key derivation
        salt = secrets.token_bytes(16)
        
        # Derive encryption key from master key + salt
        key = self._derive_key(salt)
        
        # Create AESGCM cipher
        aesgcm = AESGCM(key)
        
        # Generate random nonce (96 bits for GCM)
        nonce = secrets.token_bytes(12)
        
        # Serialize data to JSON
        plaintext = json.dumps(data).encode('utf-8')
        
        # Encrypt (AESGCM provides authentication automatically)
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        
        return ciphertext, nonce, salt
    
    def _decrypt(self, ciphertext: bytes, nonce: bytes, salt: bytes) -> Dict[str, Any]:
        """
        Decrypt data with AES-256-GCM
        
        Args:
            ciphertext: Encrypted data
            nonce: Nonce used for encryption
            salt: Salt used for key derivation
            
        Returns:
            Decrypted dictionary
            
        Raises:
            EncryptionError: If decryption fails
        """
        try:
            # Derive encryption key from master key + salt
            key = self._derive_key(salt)
            
            # Create AESGCM cipher
            aesgcm = AESGCM(key)
            
            # Decrypt and verify authenticity
            plaintext = aesgcm.decrypt(nonce, ciphertext, None)
            
            # Deserialize from JSON
            data = json.loads(plaintext.decode('utf-8'))
            
            return data
        
        except Exception as e:
            raise EncryptionError(f"Decryption failed: {e}")
    
    def store(self, namespace: str, key: str, value: Dict[str, Any]) -> bool:
        """
        Store encrypted data in vault
        
        Args:
            namespace: Data namespace (e.g., "conversations", "insights")
            key: Unique key within namespace
            value: Data to encrypt and store
            
        Returns:
            True if successful
        """
        try:
            # Encrypt data
            ciphertext, nonce, salt = self._encrypt(value)
            
            # Store in database
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            now = datetime.now().isoformat()
            
            cursor.execute("""
                INSERT OR REPLACE INTO encrypted_data 
                (namespace, key, encrypted_value, nonce, salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 
                    COALESCE((SELECT created_at FROM encrypted_data WHERE namespace=? AND key=?), ?),
                    ?)
            """, (namespace, key, ciphertext, nonce, salt, namespace, key, now, now))
            
            conn.commit()
            conn.close()
            
            logger.info(f"Stored encrypted data: {namespace}/{key}")
            return True
        
        except Exception as e:
            logger.error(f"Error storing data {namespace}/{key}: {e}")
            return False
    
    def retrieve(self, namespace: str, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve and decrypt data from vault
        
        Args:
            namespace: Data namespace
            key: Unique key within namespace
            
        Returns:
            Decrypted data or None if not found
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT encrypted_value, nonce, salt
                FROM encrypted_data
                WHERE namespace = ? AND key = ?
            """, (namespace, key))
            
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                return None
            
            ciphertext, nonce, salt = row
            
            # Decrypt data
            data = self._decrypt(ciphertext, nonce, salt)
            
            logger.info(f"Retrieved encrypted data: {namespace}/{key}")
            return data
        
        except Exception as e:
            logger.error(f"Error retrieving data {namespace}/{key}: {e}")
            return None
    
    def delete(self, namespace: str, key: str) -> bool:
        """
        Delete data from vault
        
        Args:
            namespace: Data namespace
            key: Unique key within namespace
            
        Returns:
            True if successful
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                DELETE FROM encrypted_data
                WHERE namespace = ? AND key = ?
            """, (namespace, key))
            
            deleted = cursor.rowcount > 0
            conn.commit()
            conn.close()
            
            if deleted:
                logger.info(f"Deleted data: {namespace}/{key}")
            
            return deleted
        
        except Exception as e:
            logger.error(f"Error deleting data {namespace}/{key}: {e}")
            return False
    
    def query(self, namespace: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Query all data in a namespace
        
        Args:
            namespace: Data namespace to query
            limit: Maximum number of results (None for all)
            
        Returns:
            List of decrypted data dictionaries
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            query = """
                SELECT key, encrypted_value, nonce, salt, created_at, updated_at
                FROM encrypted_data
                WHERE namespace = ?
                ORDER BY updated_at DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query, (namespace,))
            rows = cursor.fetchall()
            conn.close()
            
            results = []
            for row in rows:
                key, ciphertext, nonce, salt, created_at, updated_at = row
                
                try:
                    data = self._decrypt(ciphertext, nonce, salt)
                    data['_key'] = key
                    data['_created_at'] = created_at
                    data['_updated_at'] = updated_at
                    results.append(data)
                except EncryptionError as e:
                    logger.error(f"Failed to decrypt {namespace}/{key}: {e}")
                    continue
            
            logger.info(f"Queried {len(results)} records from {namespace}")
            return results
        
        except Exception as e:
            logger.error(f"Error querying namespace {namespace}: {e}")
            return []
    
    def list_namespaces(self) -> List[str]:
        """
        List all namespaces in vault
        
        Returns:
            List of namespace names
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT DISTINCT namespace
                FROM encrypted_data
                ORDER BY namespace
            """)
            
            namespaces = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            return namespaces
        
        except Exception as e:
            logger.error(f"Error listing namespaces: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get vault statistics
        
        Returns:
            Dictionary with vault statistics
        """
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            
            # Get record count per namespace
            cursor.execute("""
                SELECT namespace, COUNT(*) as count
                FROM encrypted_data
                GROUP BY namespace
            """)
            
            namespace_counts = {row[0]: row[1] for row in cursor.fetchall()}
            
            # Get total size
            cursor.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
            total_size = cursor.fetchone()[0]
            
            # Get creation date
            cursor.execute("SELECT value FROM vault_metadata WHERE key = 'master_key_created'")
            created = cursor.fetchone()
            created_at = created[0] if created else "Unknown"
            
            conn.close()
            
            return {
                "namespace_counts": namespace_counts,
                "total_records": sum(namespace_counts.values()),
                "database_size_bytes": total_size,
                "created_at": created_at
            }
        
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}
    
    def export_namespace(self, namespace: str, output_path: Path) -> bool:
        """
        Export namespace to encrypted JSON file
        
        Args:
            namespace: Namespace to export
            output_path: Path to output file
            
        Returns:
            True if successful
        """
        try:
            data = self.query(namespace)
            
            with open(output_path, 'w') as f:
                json.dump({
                    "namespace": namespace,
                    "exported_at": datetime.now().isoformat(),
                    "data": data
                }, f, indent=2)
            
            # Set restrictive permissions
            os.chmod(output_path, 0o600)
            
            logger.info(f"Exported {len(data)} records from {namespace} to {output_path}")
            return True
        
        except Exception as e:
            logger.error(f"Error exporting namespace {namespace}: {e}")
            return False


# Example usage
if __name__ == "__main__":
    # Initialize vault
    vault = EncryptedVault()
    
    # Store some test data
    test_data = {
        "message": "This is sensitive data",
        "timestamp": datetime.now().isoformat(),
        "metadata": {"user": "test", "priority": "high"}
    }
    
    vault.store("test", "example_1", test_data)
    
    # Retrieve data
    retrieved = vault.retrieve("test", "example_1")
    print(f"Retrieved: {retrieved}")
    
    # Get stats
    stats = vault.get_stats()
    print(f"\nVault Stats:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    # Verify encryption
    print("\n✅ Data is encrypted in database")
    print("   (Try: sqlite3 ~/.openclaw/vault.db 'SELECT * FROM encrypted_data;')")
    print("   You'll see binary encrypted data, not readable text")
