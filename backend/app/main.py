from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import assistant, auth, trips

app = FastAPI(title="TripBuggy API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(assistant.router)


@app.get("/health")
def health():
    return {"status": "ok"}
