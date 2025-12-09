"""
Cloudflare KV Encryption

Encrypts sensitive VPN configuration data before storing in Cloudflare KV.
Uses Fernet symmetric encryption with a key derived from environment variable.
"""

import json
import logging
import os
import base64
from typing import Any, Dict
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2

logger = logging.getLogger(__name__)

# Encryption configuration
VPN_ENCRYPTION_KEY = os.getenv("VPN_ENCRYPTION_KEY", "default-dev-key-DO-NOT-USE-IN-PRODUCTION")
SALT = b"rma-demo-vpn-salt-v1"  # Static salt for key derivation


class KVCrypto:
    """
    Handles encryption/decryption of KV values

    Uses Fernet (symmetric encryption) with a key derived from VPN_ENCRYPTION_KEY
    """

    def __init__(self, encryption_key: str = None):
        """
        Initialize KV crypto

        Args:
            encryption_key: Base encryption key (default: from env var)
        """
        self.base_key = encryption_key or VPN_ENCRYPTION_KEY
        self.cipher = self._initialize_cipher()

    def _initialize_cipher(self) -> Fernet:
        """
        Initialize Fernet cipher with derived key

        Returns:
            Fernet cipher instance
        """
        # Derive a proper 32-byte key from the base key using PBKDF2
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=SALT,
            iterations=100000,
        )
        key_bytes = kdf.derive(self.base_key.encode())
        fernet_key = base64.urlsafe_b64encode(key_bytes)

        cipher = Fernet(fernet_key)
        logger.debug("KV crypto initialized")
        return cipher

    def encrypt(self, data: Dict[str, Any]) -> str:
        """
        Encrypt dictionary data for KV storage

        Args:
            data: Dictionary to encrypt

        Returns:
            Encrypted string (base64 encoded)
        """
        try:
            # Serialize to JSON
            json_str = json.dumps(data, default=str)

            # Encrypt
            encrypted_bytes = self.cipher.encrypt(json_str.encode())

            # Return as base64 string
            encrypted_str = encrypted_bytes.decode('utf-8')

            logger.debug(f"Encrypted data: {len(json_str)} bytes → {len(encrypted_str)} bytes")
            return encrypted_str

        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise

    def decrypt(self, encrypted_data: str) -> Dict[str, Any]:
        """
        Decrypt KV data

        Args:
            encrypted_data: Encrypted string from KV

        Returns:
            Decrypted dictionary
        """
        try:
            # Decrypt
            encrypted_bytes = encrypted_data.encode('utf-8')
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)

            # Parse JSON
            json_str = decrypted_bytes.decode('utf-8')
            data = json.loads(json_str)

            logger.debug(f"Decrypted data: {len(encrypted_data)} bytes → {len(json_str)} bytes")
            return data

        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise

    def encrypt_field(self, data: Dict[str, Any], field: str) -> Dict[str, Any]:
        """
        Encrypt a specific field within a dictionary

        Args:
            data: Dictionary containing the field
            field: Field name to encrypt

        Returns:
            Dictionary with encrypted field
        """
        if field not in data:
            return data

        try:
            field_value = data[field]

            # Encrypt the field value
            if isinstance(field_value, dict):
                encrypted = self.encrypt(field_value)
            else:
                encrypted = self.encrypt({"value": field_value})

            # Replace with encrypted version
            data[f"{field}_encrypted"] = encrypted
            del data[field]

            logger.debug(f"Encrypted field: {field}")
            return data

        except Exception as e:
            logger.error(f"Field encryption failed: {e}")
            raise

    def decrypt_field(self, data: Dict[str, Any], field: str) -> Dict[str, Any]:
        """
        Decrypt a specific field within a dictionary

        Args:
            data: Dictionary containing encrypted field
            field: Original field name (will look for field_encrypted)

        Returns:
            Dictionary with decrypted field
        """
        encrypted_field = f"{field}_encrypted"

        if encrypted_field not in data:
            return data

        try:
            encrypted_value = data[encrypted_field]
            decrypted = self.decrypt(encrypted_value)

            # Restore original field
            if "value" in decrypted and len(decrypted) == 1:
                data[field] = decrypted["value"]
            else:
                data[field] = decrypted

            del data[encrypted_field]

            logger.debug(f"Decrypted field: {field}")
            return data

        except Exception as e:
            logger.error(f"Field decryption failed: {e}")
            raise


# Global crypto instance
kv_crypto = KVCrypto()


def encrypt_kv_value(data: Dict[str, Any]) -> str:
    """
    Encrypt data for KV storage

    Args:
        data: Dictionary to encrypt

    Returns:
        Encrypted string
    """
    return kv_crypto.encrypt(data)


def decrypt_kv_value(encrypted_data: str) -> Dict[str, Any]:
    """
    Decrypt data from KV storage

    Args:
        encrypted_data: Encrypted string

    Returns:
        Decrypted dictionary
    """
    return kv_crypto.decrypt(encrypted_data)


def should_encrypt_key(key: str) -> bool:
    """
    Determine if a KV key should be encrypted

    Args:
        key: KV key name

    Returns:
        True if key should be encrypted
    """
    # Encrypt sensitive keys
    sensitive_keys = [
        "vpn_bootstrap",  # Contains CA certificate
        "worker_certs",   # Worker certificates
    ]

    # Don't encrypt public data
    public_keys = [
        "entry_points",   # Public entry point list
        "vpn_network_enabled",  # Public network status
    ]

    if key in sensitive_keys:
        return True
    elif key in public_keys:
        return False
    else:
        # Default: encrypt unknown keys
        return True


# Example usage
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Test encryption/decryption
    test_data = {
        "ca_crt": "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAJq...",
        "lighthouse_ip": "10.42.0.1",
        "public_ip": "203.0.113.42",
        "created_at": "2025-12-09T12:00:00Z"
    }

    print("Original data:")
    print(json.dumps(test_data, indent=2))

    # Encrypt
    encrypted = encrypt_kv_value(test_data)
    print(f"\nEncrypted ({len(encrypted)} bytes):")
    print(encrypted[:100] + "..." if len(encrypted) > 100 else encrypted)

    # Decrypt
    decrypted = decrypt_kv_value(encrypted)
    print("\nDecrypted data:")
    print(json.dumps(decrypted, indent=2))

    # Verify
    assert test_data == decrypted
    print("\n✅ Encryption/decryption test passed!")

    # Test field encryption
    print("\n--- Field Encryption Test ---")
    test_data_2 = {
        "worker_id": "worker-001",
        "sensitive_info": {"password": "secret123"},
        "public_info": "hello world"
    }

    print("Original:")
    print(json.dumps(test_data_2, indent=2))

    # Encrypt specific field
    encrypted_data = kv_crypto.encrypt_field(test_data_2.copy(), "sensitive_info")
    print("\nWith encrypted field:")
    print(json.dumps(encrypted_data, indent=2))

    # Decrypt field
    decrypted_data = kv_crypto.decrypt_field(encrypted_data, "sensitive_info")
    print("\nAfter decryption:")
    print(json.dumps(decrypted_data, indent=2))

    assert test_data_2 == decrypted_data
    print("\n✅ Field encryption test passed!")
