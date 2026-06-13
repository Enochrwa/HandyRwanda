"""seed_categories

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2025-06-02 10:00:00.000000

Seeds the categories table with default HandyRwanda service categories.
This migration is idempotent — it only inserts rows that don't already exist.
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = [
    ("Gusana amazi", "Plumbing", "Plomberie", "🚿"),
    ("Amashanyarazi", "Electrical", "Électricité", "⚡"),
    ("Gusukura", "Cleaning", "Nettoyage", "🧹"),
    ("Imbaraga z'inkoni", "Carpentry", "Menuiserie", "🪚"),
    ("Gutunganya inzu", "Painting", "Peinture", "🎨"),
    ("Gusana inzu", "Masonry", "Maçonnerie", "🧱"),
    ("Gusana imodoka", "Auto Repair", "Réparation auto", "🔧"),
    ("Gusana ibikoreshwa", "Appliance Repair", "Réparation d'appareils", "🔌"),
    ("Kwiga abana", "Tutoring", "Tutorat", "📚"),
    ("Gusana ingubo", "Tailoring", "Couture", "🧵"),
    ("Ubwiza bw'umubiri", "Beauty & Wellness", "Beauté & Bien-être", "💇"),
    ("Gufotora", "Photography", "Photographie", "📸"),
    ("Gutwara abantu", "Transport & Moving", "Transport & Déménagement", "🚚"),
    ("Gusana za murandasi", "IT & Tech Support", "Support informatique", "💻"),
    ("Gukora amashyamba", "Gardening & Landscaping", "Jardinage", "🌿"),
    ("Kubika ibiryo", "Catering & Cooking", "Restauration", "🍳"),
    ("Gusana ameza", "Furniture Assembly", "Montage de meubles", "🪑"),
    ("Isuku ry'amazu", "Pest Control", "Dératisation", "🐜"),
    ("Gucunga imashini", "AC & Refrigeration", "Climatisation", "❄️"),
    ("Ibindi", "Other Services", "Autres services", "🛠️"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for name_rw, name_en, name_fr, icon_emoji in CATEGORIES:
        # Only insert if name_en doesn't already exist (idempotent)
        existing = conn.execute(
            sa.text("SELECT 1 FROM categories WHERE name_en = :name_en"),
            {"name_en": name_en},
        ).fetchone()
        if not existing:
            conn.execute(
                sa.text(
                    "INSERT INTO categories (id, name_rw, name_en, name_fr, icon_emoji, is_active) "
                    "VALUES (:id, :name_rw, :name_en, :name_fr, :icon_emoji, true)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "name_rw": name_rw,
                    "name_en": name_en,
                    "name_fr": name_fr,
                    "icon_emoji": icon_emoji,
                },
            )


def downgrade() -> None:
    op.execute(
        "DELETE FROM categories WHERE name_en IN ({})".format(
            ", ".join(f"'{name_en}'" for _, name_en, _, _ in CATEGORIES)
        )
    )
