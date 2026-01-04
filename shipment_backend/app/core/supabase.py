from supabase import create_client
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

import os
import certifi

# Ensure Python/OpenSSL uses certifi's CA bundle for SSL verification on Windows
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
