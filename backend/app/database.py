# File: backend/app/database.py
import os
from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

_DATABASE_URL = os.getenv("DATABASE_URL", "")

if _DATABASE_URL:
    if _DATABASE_URL.startswith("postgresql://"):
        _DATABASE_URL = _DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
    elif _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    DATABASE_URL = _DATABASE_URL
else:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "Munyaneza")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "EnochLabs")
    DB_NAME = os.getenv("DB_NAME", "handyrwanda")
    DATABASE_URL = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

_is_sqlite = DATABASE_URL.startswith("sqlite")

_connect_args: dict[str, object] = {"check_same_thread": False} if _is_sqlite else {}
if not _is_sqlite and DATABASE_URL.startswith("postgresql+asyncpg://"):
    parsed = urlparse(DATABASE_URL)
    query_params = parse_qs(parsed.query)

    if "sslmode" in query_params:
        sslmode = query_params["sslmode"][0]
        _connect_args["ssl"] = sslmode in ["require", "verify-ca", "verify-full"]
        query_params.pop("sslmode", None)

    if query_params:
        new_query = "&".join([f"{k}={v[0]}" for k, v in query_params.items()])
        DATABASE_URL = urlunparse(parsed._replace(query=new_query))
    else:
        DATABASE_URL = urlunparse(parsed._replace(query=""))

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


SEED_CATEGORIES = [
    {
        "name_rw": "Gusana amazi",
        "name_en": "Plumbing",
        "name_fr": "Plomberie",
        "icon_emoji": "🚿",
    },
    {
        "name_rw": "Amashanyarazi",
        "name_en": "Electrical",
        "name_fr": "Électricité",
        "icon_emoji": "⚡",
    },
    {
        "name_rw": "Gusukura",
        "name_en": "Cleaning",
        "name_fr": "Nettoyage",
        "icon_emoji": "🧹",
    },
    {
        "name_rw": "Imbaraga z'inkoni",
        "name_en": "Carpentry",
        "name_fr": "Menuiserie",
        "icon_emoji": "🪚",
    },
    {
        "name_rw": "Gutunganya inzu",
        "name_en": "Painting",
        "name_fr": "Peinture",
        "icon_emoji": "🎨",
    },
    {
        "name_rw": "Gusana inzu",
        "name_en": "Masonry",
        "name_fr": "Maçonnerie",
        "icon_emoji": "🧱",
    },
    {
        "name_rw": "Gusana imodoka",
        "name_en": "Auto Repair",
        "name_fr": "Réparation auto",
        "icon_emoji": "🔧",
    },
    {
        "name_rw": "Gusana ibikoreshwa",
        "name_en": "Appliance Repair",
        "name_fr": "Réparation d'appareils",
        "icon_emoji": "🔌",
    },
    {
        "name_rw": "Kwiga abana",
        "name_en": "Tutoring",
        "name_fr": "Tutorat",
        "icon_emoji": "📚",
    },
    {
        "name_rw": "Gusana ingubo",
        "name_en": "Tailoring",
        "name_fr": "Couture",
        "icon_emoji": "🧵",
    },
    {
        "name_rw": "Ubwiza bw'umubiri",
        "name_en": "Beauty & Wellness",
        "name_fr": "Beauté & Bien-être",
        "icon_emoji": "💇",
    },
    {
        "name_rw": "Gufotora",
        "name_en": "Photography",
        "name_fr": "Photographie",
        "icon_emoji": "📸",
    },
    {
        "name_rw": "Gutwara abantu",
        "name_en": "Transport & Moving",
        "name_fr": "Transport & Déménagement",
        "icon_emoji": "🚚",
    },
    {
        "name_rw": "Gusana za murandasi",
        "name_en": "IT & Tech Support",
        "name_fr": "Support informatique",
        "icon_emoji": "💻",
    },
    {
        "name_rw": "Gukora amashyamba",
        "name_en": "Gardening & Landscaping",
        "name_fr": "Jardinage",
        "icon_emoji": "🌿",
    },
    {
        "name_rw": "Kubika ibiryo",
        "name_en": "Catering & Cooking",
        "name_fr": "Restauration",
        "icon_emoji": "🍳",
    },
    {
        "name_rw": "Gusana ameza",
        "name_en": "Furniture Assembly",
        "name_fr": "Montage de meubles",
        "icon_emoji": "🪑",
    },
    {
        "name_rw": "Isuku ry'amazu",
        "name_en": "Pest Control",
        "name_fr": "Dératisation",
        "icon_emoji": "🐜",
    },
    {
        "name_rw": "Gucunga imashini",
        "name_en": "AC & Refrigeration",
        "name_fr": "Climatisation",
        "icon_emoji": "❄️",
    },
    {
        "name_rw": "Ibindi",
        "name_en": "Other Services",
        "name_fr": "Autres services",
        "icon_emoji": "🛠️",
    },
]


async def init_db() -> None:
    from . import models  # noqa: F401, PLC0415
    from .models.artisan import Category  # noqa: PLC0415

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed categories if none exist
    async with AsyncSessionLocal() as session:
        from sqlalchemy import func, select  # noqa: PLC0415

        count = await session.scalar(select(func.count(Category.id)))
        if count == 0:
            import uuid  # noqa: PLC0415

            for cat_data in SEED_CATEGORIES:
                cat = Category(
                    id=uuid.uuid4(),
                    name_rw=cat_data["name_rw"],
                    name_en=cat_data["name_en"],
                    name_fr=cat_data["name_fr"],
                    icon_emoji=cat_data["icon_emoji"],
                    is_active=True,
                )
                session.add(cat)
            await session.commit()
