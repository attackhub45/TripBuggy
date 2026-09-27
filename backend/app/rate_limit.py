import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# conftest.py sets DISABLE_RATE_LIMIT=1 before the app is imported — the 79-test pytest
# suite reuses one process/one client IP across many calls to the same endpoints, which
# would otherwise trip these limits well before a single test even gets there.
limiter = Limiter(key_func=get_remote_address, enabled=os.environ.get("DISABLE_RATE_LIMIT") != "1")
