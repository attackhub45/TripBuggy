import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import settings
from .rate_limit import limiter
from .routers import admin, assistant, auth, destinations, trips

app = FastAPI(title="TripBuggy API", version="0.1.0")

# Only configured when APPLICATIONINSIGHTS_CONNECTION_STRING is set (Azure app setting in
# production) — no-op for local dev, where there's no Application Insights resource to send to.
if os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    from azure.monitor.opentelemetry import configure_azure_monitor
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    configure_azure_monitor(logger_name="app")
    FastAPIInstrumentor.instrument_app(app)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(assistant.router)
app.include_router(admin.router)
app.include_router(destinations.router)


@app.get("/health")
def health():
    return {"status": "ok"}
