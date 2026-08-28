import os


os.environ.setdefault(
    "SUPABASE_URL",
    "https://example.supabase.co",
)

os.environ.setdefault(
    "SUPABASE_PUBLISHABLE_KEY",
    "test-publishable-key",
)

os.environ.setdefault(
    "SUPABASE_SECRET_KEY",
    "test-secret-key",
)

os.environ.setdefault(
    "GEMINI_API_KEY",
    "test-gemini-key",
)

os.environ.setdefault(
    "ALLOWED_ORIGINS",
    (
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    ),
)

os.environ.setdefault(
    "RATE_LIMIT_HMAC_KEY",
    (
        "test-rate-limit-key-that-is-"
        "longer-than-thirty-two-characters"
    ),
)
