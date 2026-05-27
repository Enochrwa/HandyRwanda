# File: backend/app/main.py
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import admin, artisans, auth, bids, jobs, messages, bookings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Auto-create tables in dev (SQLite). No-op when DATABASE_URL points to PG.
    if not os.getenv("DATABASE_URL"):
        await init_db()
    yield


app = FastAPI(title="HandyRwanda API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8081", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(artisans.router)
app.include_router(admin.router)
app.include_router(jobs.router)
app.include_router(bids.router)
app.include_router(messages.router)
app.include_router(bookings.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
