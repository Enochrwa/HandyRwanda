# File: backend/server.py
"""
Entry-point for the HandyRwanda backend.

IMPORTANT: We run `app.main:application` (the Socket.IO + FastAPI combined
ASGI app), NOT `app.main:app` (bare FastAPI).  The `application` object is
created by socket_manager.create_combined_asgi() and wraps the FastAPI `app`
so that Socket.IO handles /socket.io/* paths while FastAPI handles everything
else.
"""
import os

import uvicorn

from app.logging_config import configure_logging

configure_logging()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    is_dev = os.getenv("ENV", "development") == "development"

    uvicorn.run(
        # Point at the combined ASGI app, not bare FastAPI
        "app.main:application",
        host="0.0.0.0",
        port=port,
        # Reload works fine with the ASGI wrapper
        reload=is_dev,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        # Allow WebSocket upgrades (required by Socket.IO transport)
        ws="auto",
    )
