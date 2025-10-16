from cryptography.fernet import Fernet
from flask import current_app

def get_cipher():
    """Initializes the cipher with the key from config."""
    key = current_app.config.get('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY not set in config!")
    return Fernet(key.encode())

def encrypt_token(token: str) -> str:
    """Encrypts a token and returns it as a string."""
    if not token:
        return None
    cipher = get_cipher()
    return cipher.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypts an encrypted token and returns it as a string."""
    if not encrypted_token:
        return None
    try:
        cipher = get_cipher()
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        current_app.logger.error(f"Failed to decrypt token: {e}")
        return None 