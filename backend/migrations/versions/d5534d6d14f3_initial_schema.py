"""initial_schema

Revision ID: d5534d6d14f3
Revises:
Create Date: 2025-05-22 21:26:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from geoalchemy2 import Geography

# revision identifiers, used by Alembic.
revision: str = 'd5534d6d14f3'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('phone_number', sa.String(length=20), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('role', sa.Enum('client', 'artisan', 'admin', name='userrole'), nullable=False),
        sa.Column('preferred_lang', sa.String(length=5), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('expo_push_token', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('phone_number')
    )

    # Categories
    op.create_table('categories',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name_rw', sa.String(length=100), nullable=False),
        sa.Column('name_en', sa.String(length=100), nullable=False),
        sa.Column('name_fr', sa.String(length=100), nullable=False),
        sa.Column('icon_emoji', sa.String(length=10), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Artisan Profiles
    op.create_table('artisan_profiles',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('bio', sa.String(length=500), nullable=True),
        sa.Column('years_experience', sa.Integer(), nullable=True),
        sa.Column('service_radius_km', sa.Integer(), nullable=True),
        sa.Column('location', Geography(geometry_type='POINT', srid=4326, from_text='ST_GeomFromWKB', name='geography'), nullable=True),
        sa.Column('location_label', sa.String(length=200), nullable=True),
        sa.Column('hourly_rate', sa.Integer(), nullable=True),
        sa.Column('fixed_rate', sa.Integer(), nullable=True),
        sa.Column('spoken_languages', sa.String(), nullable=True),
        sa.Column('verification_status', sa.Enum('unverified', 'pending', 'id_verified', 'pro_verified', 'rejected', name='verificationstatus'), nullable=True),
        sa.Column('is_available', sa.Boolean(), nullable=True),
        sa.Column('average_rating', sa.Float(), nullable=True),
        sa.Column('total_reviews', sa.Integer(), nullable=True),
        sa.Column('response_rate', sa.Float(), nullable=True),
        sa.Column('on_time_rate', sa.Float(), nullable=True),
        sa.Column('repeat_client_rate', sa.Float(), nullable=True),
        sa.Column('completion_rate', sa.Float(), nullable=True),
        sa.Column('community_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('user_id')
    )

    # Artisan Skills Junction
    op.create_table('artisan_skills',
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisan_profiles.user_id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.PrimaryKeyConstraint('artisan_id', 'category_id')
    )

    # Portfolio Photos
    op.create_table('portfolio_photos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('job_type', sa.String(length=100), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisan_profiles.user_id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Jobs
    op.create_table('jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('location', sa.String(), nullable=True),
        sa.Column('location_label', sa.String(length=200), nullable=True),
        sa.Column('scheduled_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('budget', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('open', 'pending_bid', 'booked', 'in_progress', 'completed', 'cancelled', 'disputed', name='jobstatus'), nullable=True),
        sa.Column('photos_urls', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Bids
    op.create_table('bids',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_id', sa.UUID(), nullable=False),
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('proposed_price', sa.Integer(), nullable=False),
        sa.Column('message', sa.String(length=500), nullable=True),
        sa.Column('proposed_start_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('pending', 'accepted', 'rejected', name='bidstatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisan_profiles.user_id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Bookings
    op.create_table('bookings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.Enum('pending_payment', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed', name='bookingstatus'), nullable=True),
        sa.Column('agreed_price', sa.Integer(), nullable=False),
        sa.Column('before_photo_url', sa.String(), nullable=True),
        sa.Column('after_photo_url', sa.String(), nullable=True),
        sa.Column('before_photo_taken_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('auto_confirm_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisan_profiles.user_id'], ),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Reviews
    op.create_table('reviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('booking_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('artisan_id', sa.UUID(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.String(length=500), nullable=True),
        sa.Column('artisan_reply', sa.String(length=300), nullable=True),
        sa.Column('is_flagged', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['artisan_id'], ['artisan_profiles.user_id'], ),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['client_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('booking_id')
    )

    # Messages
    op.create_table('messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('booking_id', sa.UUID(), nullable=False),
        sa.Column('sender_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('translated_content', sa.String(), nullable=True),
        sa.Column('voice_note_url', sa.String(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Transactions
    op.create_table('transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('booking_id', sa.UUID(), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('payment_in', 'payout_out', 'commission', 'refund', name='transactiontype'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'completed', 'failed', name='transactionstatus'), nullable=True),
        sa.Column('momo_reference', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Notifications
    op.create_table('notifications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Referrals
    op.create_table('referrals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('referrer_id', sa.UUID(), nullable=False),
        sa.Column('referred_id', sa.UUID(), nullable=False),
        sa.Column('referral_code', sa.String(length=20), nullable=False),
        sa.Column('status', sa.Enum('registered', 'qualified', name='referralstatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['referred_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('referrals')
    op.drop_table('notifications')
    op.drop_table('transactions')
    op.drop_table('messages')
    op.drop_table('reviews')
    op.drop_table('bookings')
    op.drop_table('bids')
    op.drop_table('jobs')
    op.drop_table('portfolio_photos')
    op.drop_table('artisan_skills')
    op.drop_table('artisan_profiles')
    op.drop_table('categories')
    op.drop_table('users')
    sa.Enum(name='userrole').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='verificationstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='jobstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='bidstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='bookingstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='transactiontype').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='transactionstatus').drop(op.get_bind(), checkfirst=False)
    sa.Enum(name='referralstatus').drop(op.get_bind(), checkfirst=False)
