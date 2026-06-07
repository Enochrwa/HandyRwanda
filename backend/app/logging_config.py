# File: backend/app/logging_config.py
"""
Structured logging configuration for HandyRwanda.
JSON in production, human-readable in development.
"""

import logging
import os
import sys


def configure_logging() -> None:
    env = os.getenv("ENV", "development")
    level_name = os.getenv("LOG_LEVEL", "INFO" if env == "production" else "DEBUG")
    level = getattr(logging, level_name.upper(), logging.INFO)

    if env == "production":
        fmt = "%(asctime)s %(levelname)s %(name)s %(message)s"
    else:
        fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    logging.basicConfig(
        level=level,
        format=fmt,
        datefmt="%Y-%m-%dT%H:%M:%S",
        stream=sys.stdout,
    )

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(
        logging.WARNING if env == "production" else logging.INFO
    )
