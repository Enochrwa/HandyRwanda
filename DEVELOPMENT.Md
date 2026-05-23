# HandyRwanda: Highly Detailed Technical Blueprint

## 1. Introduction

This document serves as a comprehensive technical blueprint for the HandyRwanda application, detailing its architecture, core features, and a phased development roadmap. The primary objective is to construct a robust, scalable, and user-friendly platform capable of achieving viral growth across Rwanda, Africa, and beyond, while ensuring sustainable monetization through carefully designed mechanisms. This blueprint provides granular technical specifications for each feature and sprint, guiding developers through the implementation process.

## 2. Core Principles & Design Philosophy

Building upon the foundational principles, our development adheres to:

*   **Mobile-First & Offline-Capable**: Prioritizing a seamless experience on mobile devices, even in low-connectivity environments. This involves aggressive caching and background synchronization strategies.
*   **Africa-Centric**: Tailoring authentication, payment, and language support to the local context, leveraging mobile money and local languages.
*   **Trust & Safety**: Implementing robust mechanisms for user verification, secure transactions, and dispute resolution to foster a reliable marketplace.
*   **Scalability**: Designing for future expansion in terms of user base, service categories, and geographical reach, utilizing cloud-native services and microservices principles.
*   **Maintainability**: Adhering to best practices in code quality, documentation, testing (unit, integration, end-to-end), and continuous integration/continuous deployment (CI/CD).
*   **Cost-Effectiveness**: Leveraging free-tier services and open-source technologies where possible to minimize operational costs during initial growth phases.

## 3. Technical Architecture Overview

HandyRwanda will employ a modern, cloud-native architecture optimized for performance, scalability, and cost-efficiency. The system is composed of distinct, interconnected services:

### 3.1. Mobile Frontend (Client & Artisan Applications)

*   **Technology Stack**: React Native (Expo SDK 51+), TypeScript.
*   **Key Libraries/Frameworks**:
    *   `react-navigation v6+`: For declarative and robust navigation across app screens, supporting deep linking and authentication flows.
    *   `redux-toolkit` / `zustand`: For efficient and predictable global state management. `zustand` is preferred for simpler, less boilerplate-heavy state needs, while `redux-toolkit` can be used for more complex, domain-specific state slices.
    *   `axios` / `fetch`: For making HTTP requests to the Backend API. `axios` for its interceptors and error handling capabilities.
    *   `expo-location`: For precise location services, including foreground and background location tracking (with user permission) and geocoding.
    *   `react-native-maps` (integrated with OpenStreetMap tiles via `react-native-maps-osmdroid` for Android and `react-native-maps-osmiOS` for iOS): For interactive map rendering, displaying artisan locations, job sites, and service radii. OpenStreetMap is chosen for cost-effectiveness and good coverage in Africa.
    *   `expo-image-picker` / `expo-camera`: For capturing and selecting images (e.g., profile pictures, job photos, ID documents) from the device gallery or camera.
    *   `expo-notifications`: For handling push notifications across iOS and Android, integrated with Expo Push Notification Service.
    *   `expo-localization` / `i18n-js`: For comprehensive multi-language support, enabling dynamic language switching between Kinyarwanda, English, and French.
    *   `expo-sqlite` / `AsyncStorage`: For local data caching and persistence, enabling offline functionality. `expo-sqlite` for structured data (e.g., cached artisan profiles, service categories) and `AsyncStorage` for key-value pairs (e.g., user preferences, JWT tokens).
    *   `react-native-webview`: For embedding web content, potentially for payment gateways or terms of service.
*   **Deployment Strategy**: Expo Application Services (EAS) for streamlined builds, over-the-air (OTA) updates, and submission to app stores.

### 3.2. Web Frontend (Artisan Profiles & Admin Dashboard)

*   **Technology Stack**: Next.js 14 (App Router), React, TypeScript, TailwindCSS.
*   **Key Libraries/Frameworks**:
    *   `react-query` / `swr`: For efficient server-state management, data fetching, caching, and synchronization. `react-query` is preferred for its robust features and developer experience.
    *   `next-auth`: For secure, flexible authentication for the Admin Dashboard, supporting various providers (e.g., email/password, OAuth for internal team).
    *   `leaflet.js` (with OpenStreetMap tiles): For web-based interactive map display in the admin dashboard and potentially for artisan web profiles.
    *   `chart.js` / `recharts`: For creating dynamic and responsive data visualizations within the Admin Dashboard (e.g., revenue trends, user growth, job statistics).
    *   `shadcn/ui` / `Radix UI`: For building accessible and customizable UI components, ensuring a consistent design system.
*   **Deployment Strategy**: Vercel for serverless deployment, continuous integration (CI), and global content delivery network (CDN).

### 3.3. Backend API (Microservice Architecture)

*   **Technology Stack**: FastAPI (Python 3.11+), leveraging asynchronous programming (`async/await`).
*   **Key Libraries/Frameworks**:
    *   `SQLAlchemy 2.0+` (with `asyncpg` driver): For asynchronous Object-Relational Mapping (ORM) interaction with PostgreSQL, ensuring efficient database operations.
    *   `Pydantic v2+`: For data validation, serialization, and deserialization of request and response models, ensuring type safety and clear API contracts.
    *   `python-jose`: For handling JSON Web Tokens (JWT) for secure API authentication and authorization.
    *   `Africa's Talking SDK (Python)`: For reliable and cost-effective SMS and USSD services, crucial for OTP delivery and feature phone support.
    *   `python-cloudinary`: For seamless integration with Cloudinary for image storage, optimization, and delivery.
    *   `websockets`: For implementing real-time, bidirectional communication channels (e.g., for in-app chat, live job updates).
    *   `FastAPI-Users`: A robust library for user management, authentication, and authorization boilerplate, accelerating development.
    *   `Celery` (with Redis as broker): For asynchronous task processing (e.g., sending bulk notifications, processing image uploads in the background, scheduled tasks).
*   **Deployment Strategy**: Railway.app for containerized deployment (Docker), providing managed infrastructure for FastAPI, PostgreSQL, and Redis.

### 3.4. Database

*   **Technology**: PostgreSQL 15 with PostGIS extension.
*   **Key Features**:
    *   **PostGIS**: Essential for efficient geospatial queries, enabling features like finding artisans within a specific radius, geofencing, and location-based job matching. Stores location data as `GEOGRAPHY(POINT, 4326)`.
    *   **JSONB**: For flexible storage of dynamic, semi-structured data (e.g., service-specific attributes, job metadata) without rigid schema migrations.
    *   **Indexes**: Comprehensive indexing strategy for frequently queried columns (e.g., user IDs, phone numbers, location data, job statuses, timestamps) to ensure optimal query performance.
    *   **UUIDs**: Primary keys will be UUIDs to prevent enumeration attacks and simplify distributed system design.
*   **Deployment Strategy**: Managed PostgreSQL service (e.g., Railway.app PostgreSQL, Supabase, or a dedicated cloud provider like AWS RDS/Azure Database for PostgreSQL) for high availability, backups, and scaling.

### 3.5. Caching & Real-time Messaging

*   **Technology**: Redis 7.
*   **Use Cases**:
    *   **Caching**: Storing frequently accessed, read-heavy data (e.g., popular service categories, artisan search results, configuration settings) to reduce database load and improve response times.
    *   **Session Management**: Storing JWT blacklists, OTP codes with Time-To-Live (TTL), and rate-limiting counters.
    *   **Pub/Sub**: Facilitating real-time communication for WebSocket events (e.g., job status updates, chat messages) across multiple backend instances.
    *   **Task Queue**: As a broker for Celery, managing asynchronous tasks.
*   **Deployment Strategy**: Managed Redis service (e.g., Railway.app Redis, Upstash) for high performance and reliability.

### 3.6. Third-Party Integrations

*   **SMS/OTP**: Africa's Talking (for reliable, local SMS delivery and USSD gateway).
*   **Image Storage & CDN**: Cloudinary (free tier for initial scale, robust image manipulation, optimization, and global CDN delivery).
*   **Maps**: OpenStreetMap (via Leaflet.js and react-native-maps) for cost-effective and locally relevant map data.
*   **Push Notifications**: Expo Push Notification Service (integrated with `expo-notifications` for cross-platform push capabilities).
*   **Payment Gateways**: MTN MoMo API, Airtel Money API (integrated in later sprints for local mobile money transactions).

## 4. Detailed Feature Specifications & Technical Considerations

This section elaborates on the technical implementation details for core features.

### 4.1. User Management & Authentication

*   **User Roles**: `ENUM` type in PostgreSQL: `('client', 'artisan', 'admin')`. Stored in `users.role`.
*   **Authentication Flow (Phone Number + OTP)**:
    *   **Backend (FastAPI)**:
        *   `POST /auth/otp/request`: Accepts `phone_number` (E.164 format). Generates a 6-digit OTP, stores it in Redis with a 5-minute TTL (key: `otp:{phone_number}`, value: `otp_code`). Sends OTP via Africa's Talking SMS API. Returns `{'message': 'OTP sent'}`.
        *   `POST /auth/otp/verify`: Accepts `phone_number`, `otp_code`. Validates OTP against Redis. If valid, generates JWT access and refresh tokens using `python-jose`. If user doesn't exist, creates a new user with `role='client'`. Returns `{'access_token': '...', 'refresh_token': '...', 'token_type': 'bearer'}`.
        *   `POST /auth/refresh`: Accepts `refresh_token`. Issues new access token.
        *   `POST /auth/logout`: Invalidates refresh token (adds to Redis blacklist).
    *   **Mobile Frontend (React Native)**:
        *   **Screens**: `PhoneNumberInputScreen`, `OTPScreen`, `RegistrationScreen` (for new users to set name, optional email).
        *   **Logic**: Uses `axios` to call `/auth/otp/request` and `/auth/otp/verify`. Stores JWT tokens securely using `AsyncStorage` or `expo-secure-store`. Navigates to `HomeScreen` on successful login.
*   **User Profiles**:
    *   **Database Schema (`users` table)**:
        ```sql
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            phone_number VARCHAR(20) UNIQUE NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE,
            avatar_url TEXT,
            role user_role NOT NULL DEFAULT 'client',
            preferred_lang VARCHAR(10) NOT NULL DEFAULT 'en',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_users_phone_number ON users (phone_number);
        ```
    *   **Backend (FastAPI)**:
        *   `GET /users/me`: Returns current user's profile based on JWT.
        *   `PUT /users/me`: Updates current user's profile (name, email, preferred_lang). Handles avatar upload to Cloudinary via `python-cloudinary` and updates `avatar_url`.
    *   **Mobile Frontend (React Native)**:
        *   **Screen**: `ProfileScreen` to display and edit user details. Uses `expo-image-picker` for avatar upload.

### 4.2. Artisan Onboarding & Verification

*   **Registration & Profile Details**:
    *   **Database Schema (`artisan_profiles` table)**:
        ```sql
        CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
        CREATE TABLE artisan_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            bio TEXT,
            years_experience INTEGER,
            service_radius_km INTEGER,
            location GEOGRAPHY(POINT, 4326),
            location_label VARCHAR(255), -- Human-readable address
            verification_status verification_status NOT NULL DEFAULT 'unverified',
            national_id_number VARCHAR(50) UNIQUE,
            national_id_doc_url TEXT, -- Cloudinary URL
            selfie_url TEXT, -- Cloudinary URL
            is_available BOOLEAN NOT NULL DEFAULT TRUE,
            average_rating NUMERIC(2,1) DEFAULT 0.0,
            total_reviews INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_artisan_location ON artisan_profiles USING GIST (location);
        CREATE INDEX idx_artisan_verification_status ON artisan_profiles (verification_status);
        ```
    *   **Database Schema (`categories` table)**:
        ```sql
        CREATE TABLE categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            icon_url TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
        );
        ```
    *   **Database Schema (`artisan_skills` junction table)**:
        ```sql
        CREATE TABLE artisan_skills (
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            PRIMARY KEY (artisan_id, category_id)
        );
        ```
    *   **Backend (FastAPI)**:
        *   `POST /artisans/profile`: Creates/updates artisan profile. Handles `national_id_doc_url` and `selfie_url` uploads to Cloudinary.
        *   `GET /artisans/profile/me`: Retrieves current artisan's profile.
        *   `GET /categories`: Lists all active service categories.
        *   `POST /artisans/skills`: Adds skills to an artisan's profile.
        *   `DELETE /artisans/skills/{category_id}`: Removes a skill.
    *   **Mobile Frontend (React Native - Artisan App)**:
        *   **Screens**: `ArtisanOnboardingScreen` (multi-step form for bio, experience, service radius, location picker using `react-native-maps`), `IDVerificationScreen` (for `expo-image-picker` uploads of ID and selfie).
        *   **Logic**: Uses `expo-location` for current location, allows manual map pin placement. Calls relevant FastAPI endpoints.
*   **Verification Workflow (Admin)**:
    *   **Backend (FastAPI - Admin APIs, protected by `admin` role)**:
        *   `GET /admin/artisans/pending`: Lists artisans with `verification_status='pending'`.
        *   `POST /admin/artisans/{user_id}/verify`: Sets `verification_status='verified'` for an artisan. Sends push notification to artisan.
        *   `POST /admin/artisans/{user_id}/reject`: Sets `verification_status='rejected'` and adds `rejection_reason`. Sends push notification to artisan.
    *   **Web Frontend (Next.js - Admin Dashboard)**:
        *   **Screen**: `ArtisanVerificationDashboard`. Displays list of pending artisans, their profiles, uploaded ID documents, and selfies. Admin can approve/reject with comments.

### 4.3. Job Posting & Matching (Client-Side)

*   **Job Creation**:
    *   **Database Schema (`jobs` table)**:
        ```sql
        CREATE TYPE job_status AS ENUM ('open', 'pending_bid_acceptance', 'booked', 'in_progress', 'completed', 'cancelled', 'disputed');
        CREATE TABLE jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            location GEOGRAPHY(POINT, 4326) NOT NULL,
            location_label VARCHAR(255) NOT NULL,
            scheduled_time TIMESTAMP WITH TIME ZONE,
            budget NUMERIC(10, 2), -- Optional, client can suggest
            status job_status NOT NULL DEFAULT 'open',
            photos_urls TEXT[], -- Array of Cloudinary URLs
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_jobs_location ON jobs USING GIST (location);
        CREATE INDEX idx_jobs_status ON jobs (status);
        CREATE INDEX idx_jobs_client_id ON jobs (client_id);
        ```
    *   **Backend (FastAPI)**:
        *   `POST /jobs`: Client creates a new job. Handles photo uploads to Cloudinary. After creation, triggers a background task (Celery) to notify relevant artisans.
    *   **Mobile Frontend (React Native - Client App)**:
        *   **Screen**: `JobPostScreen`. Multi-step form for job details, category selection, location picker (`react-native-maps`), optional photo uploads (`expo-image-picker`).
*   **Artisan Discovery & Job Search**:
    *   **Backend (FastAPI)**:
        *   `GET /jobs/available`: Artisans can query for jobs. Filters by `category_id`, `status='open'`, and `ST_DWithin(jobs.location, artisan_profile.location, artisan_profile.service_radius_km * 1000)`. Returns paginated results.
        *   `GET /artisans/search`: Clients can search for artisans. Filters by `category_id`, `ST_DWithin(client_location, artisan_profile.location, search_radius_km * 1000)`. Orders by `average_rating` and `is_available`.
    *   **Mobile Frontend (React Native)**:
        *   **Client App**: `ArtisanSearchScreen` (search input, map view of artisans), `ArtisanListScreen` (list view of artisans).
        *   **Artisan App**: `JobFeedScreen` (displays available jobs).
*   **Bid/Quote System**:
    *   **Database Schema (`bids` table)**:
        ```sql
        CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
        CREATE TABLE bids (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            proposed_price NUMERIC(10, 2) NOT NULL,
            message TEXT,
            status bid_status NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_bids_job_id ON bids (job_id);
        CREATE INDEX idx_bids_artisan_id ON bids (artisan_id);
        ```
    *   **Backend (FastAPI)**:
        *   `POST /jobs/{job_id}/bids`: Artisan submits a bid. Sends push notification to client.
        *   `POST /bids/{bid_id}/accept`: Client accepts a bid. Updates `bid.status` to 'accepted', `job.status` to 'pending_bid_acceptance'. Creates a `booking` entry. Sends push notifications to both artisan and client.
        *   `POST /bids/{bid_id}/reject`: Client rejects a bid. Updates `bid.status` to 'rejected'.
    *   **Mobile Frontend (React Native)**:
        *   **Artisan App**: `JobDetailScreen` (view job, submit bid form).
        *   **Client App**: `JobDetailScreen` (view bids, accept/reject bid buttons).

### 4.4. Booking Management

*   **Booking Flow**:
    *   **Database Schema (`bookings` table)**:
        ```sql
        CREATE TYPE booking_status AS ENUM ('pending_payment', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'disputed');
        CREATE TABLE bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            agreed_price NUMERIC(10, 2) NOT NULL,
            status booking_status NOT NULL DEFAULT 'pending_payment',
            scheduled_time TIMESTAMP WITH TIME ZONE,
            start_time TIMESTAMP WITH TIME ZONE,
            end_time TIMESTAMP WITH TIME ZONE,
            cancellation_reason TEXT,
            dispute_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_bookings_artisan_id ON bookings (artisan_id);
        CREATE INDEX idx_bookings_client_id ON bookings (client_id);
        CREATE INDEX idx_bookings_status ON bookings (status);
        ```
    *   **Backend (FastAPI)**:
        *   `GET /bookings/client`: Lists client's bookings.
        *   `GET /bookings/artisan`: Lists artisan's bookings.
        *   `POST /bookings/{booking_id}/start`: Artisan marks job as started. Updates `booking.status` to 'in_progress', sets `start_time`. Sends push notification.
        *   `POST /bookings/{booking_id}/complete`: Artisan marks job as completed. Updates `booking.status` to 'completed', sets `end_time`. Triggers payment processing (if integrated) or notification for client to confirm.
        *   `POST /bookings/{booking_id}/confirm_completion`: Client confirms job completion. Triggers payment release (if integrated).
        *   `POST /bookings/{booking_id}/cancel`: Client/Artisan cancels booking. Requires `cancellation_reason`. Updates `booking.status` to 'cancelled'.
        *   `POST /bookings/{booking_id}/dispute`: Client/Artisan raises dispute. Requires `dispute_reason`. Updates `booking.status` to 'disputed'.
    *   **Mobile Frontend (React Native)**:
        *   **Screens**: `ClientBookingsScreen`, `ArtisanBookingsScreen`, `BookingDetailScreen` (shows status, start/complete buttons, cancel/dispute options).
*   **Real-time Status Updates (WebSockets)**:
    *   **Backend (FastAPI)**:
        *   `GET /ws/{user_id}`: WebSocket endpoint. On connection, associates `user_id` with WebSocket. When a booking status changes, FastAPI publishes an update to a Redis Pub/Sub channel. WebSocket listener receives this and sends update to connected clients.
    *   **Mobile Frontend (React Native)**:
        *   **Logic**: Uses `react-native-websocket` or similar to connect to `/ws/{user_id}`. Updates UI dynamically based on received messages.
*   **In-App Chat**:
    *   **Database Schema (`messages` table)**:
        ```sql
        CREATE TABLE messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_messages_booking_id ON messages (booking_id);
        ```
    *   **Backend (FastAPI)**:
        *   `GET /bookings/{booking_id}/messages`: Retrieves chat history for a booking.
        *   `POST /bookings/{booking_id}/messages`: Sends a new message. Publishes to Redis Pub/Sub for real-time delivery via WebSockets.
    *   **Mobile Frontend (React Native)**:
        *   **Screen**: `ChatScreen` within `BookingDetailScreen`. Displays messages, input field. Connects to WebSocket for real-time message sending/receiving.

### 4.5. Reviews & Ratings

*   **Post-Completion Review**:
    *   **Database Schema (`reviews` table)**:
        ```sql
        CREATE TABLE reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_reviews_artisan_id ON reviews (artisan_id);
        ```
    *   **Backend (FastAPI)**:
        *   `POST /bookings/{booking_id}/review`: Client submits a review. Only allowed if `booking.status` is 'completed' and no existing review for `booking_id`. Triggers update of `artisan_profiles.average_rating` and `total_reviews`.
    *   **Mobile Frontend (React Native - Client App)**:
        *   **Screen**: `ReviewScreen`. Appears after job completion confirmation. Star rating component, comment input.
*   **Artisan Reputation**:
    *   **Backend (FastAPI)**:
        *   Triggered by `POST /bookings/{booking_id}/review`. Updates `artisan_profiles.average_rating` and `total_reviews` using a database trigger or a background task (Celery).
    *   **Mobile Frontend (React Native)**:
        *   **UI**: Artisan profiles display `average_rating` and `total_reviews`.

### 4.6. Geo-Search & Maps

*   **Location Services**:
    *   **Mobile Frontend (React Native)**:
        *   Uses `expo-location` to get current device location. Prompts user for permission. Allows manual location input via search bar and map interaction.
    *   **Backend (FastAPI)**:
        *   Receives location as `latitude`, `longitude`. Converts to PostGIS `GEOGRAPHY(POINT, 4326)` for storage and queries.
*   **Map Display**:
    *   **Mobile Frontend (React Native)**:
        *   `react-native-maps` displays current location, job locations, and nearby artisans. Uses custom markers for artisans.
    *   **Web Frontend (Next.js - Admin)**:
        *   `leaflet.js` displays artisan locations, job locations, and service areas on a map.

### 4.7. Notifications

*   **Push Notifications**:
    *   **Backend (FastAPI)**:
        *   Stores `expo_push_token` in `users` table. When an event occurs (e.g., new bid, booking status change), FastAPI calls Expo Push Notification API with the relevant token and message payload.
    *   **Mobile Frontend (React Native)**:
        *   Registers for push notifications using `expo-notifications`. Handles incoming notifications (displaying alerts, navigating to relevant screens).
*   **SMS Fallback**:
    *   **Backend (FastAPI)**:
        *   For critical events or users without push tokens, FastAPI uses Africa's Talking SMS API to send text messages (e.g., OTP, job accepted, payment confirmation).

### 4.8. Admin Dashboard

*   **Technology**: Next.js 14 (App Router) with React, TypeScript, TailwindCSS, `shadcn/ui`.
*   **Backend (FastAPI - Admin APIs, protected by `admin` role)**:
    *   **User Management**: `GET /admin/users`, `GET /admin/users/{user_id}`, `PUT /admin/users/{user_id}`, `DELETE /admin/users/{user_id}` (soft delete/ban).
    *   **Job Management**: `GET /admin/jobs`, `PUT /admin/jobs/{job_id}/status`.
    *   **Dispute Resolution**: `GET /admin/disputes` (lists disputed bookings), `PUT /admin/disputes/{booking_id}/resolve` (marks as resolved, records resolution details).
    *   **Analytics**: `GET /admin/analytics/summary` (returns counts of users, artisans, jobs, bookings, revenue figures).
    *   **Broadcast Tool**: `POST /admin/notifications/broadcast` (sends push/SMS to all users/artisans).
*   **Web Frontend (Next.js - Admin Dashboard)**:
    *   **UI**: Data tables for users, artisans, jobs, bookings, disputes. Forms for editing. Charts (`chart.js`) for analytics summary. Dedicated screens for artisan verification and dispute resolution.

### 4.9. Offline Mode

*   **Data Caching**:
    *   **Mobile Frontend (React Native)**:
        *   Uses `expo-sqlite` to store structured data (e.g., recently viewed artisan profiles, service categories, active booking details) locally.
        *   `AsyncStorage` for key-value pairs (e.g., user preferences, last sync timestamp).
*   **Sync Mechanism**:
    *   **Mobile Frontend (React Native)**:
        *   Implements a background sync service (e.g., using `expo-task-manager` or `react-native-background-fetch`) that periodically attempts to synchronize local changes with the backend when connectivity is available.
        *   API requests are queued locally when offline and retried when online.
    *   **Backend (FastAPI)**:
        *   Provides idempotent API endpoints for batch updates from offline clients.

### 4.10. Localisation (i18n)

*   **Multi-language Support**: Kinyarwanda (`rw`), English (`en`), French (`fr`).
    *   **Mobile Frontend (React Native)**:
        *   Uses `expo-localization` to detect device language and `i18n-js` for managing translation strings. All UI text is externalized.
    *   **Backend (FastAPI)**:
        *   `users.preferred_lang` stores user's language preference. API responses (e.g., notification messages) can be localized based on this preference.

## 5. Monetization Strategy (No Upfront Cost Integrations)

To ensure profitability without expensive upfront payment gateway integrations, we focus on models that leverage existing mobile money rails or internal management, with full payment automation in later sprints.

*   **Commission on Completed Jobs**:
    *   **Technical**: The `bookings` table will track `agreed_price`. Upon `booking.status` becoming 'completed' (and client confirmation), a background task (Celery) calculates the commission (`agreed_price * commission_rate_for_category`). This commission is notionally transferred to the platform's internal ledger. The remaining amount is due to the artisan. In early stages, this is tracked internally, and payouts are manual or semi-manual. Once payment integration is live, this becomes an automated deduction from the escrow.
*   **Premium Artisan Subscriptions**:
    *   **Database Schema (`artisan_subscriptions` table)**:
        ```sql
        CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'expired');
        CREATE TABLE artisan_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            status subscription_status NOT NULL DEFAULT 'active',
            payment_reference VARCHAR(255), -- For manual/mobile money payments
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE subscription_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) UNIQUE NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            duration_days INTEGER NOT NULL,
            features JSONB -- e.g., {'featured_placement': true, 'analytics_access': true}
        );
        ```
    *   **Features**: Featured placement in search results (a boolean flag `is_premium` on `artisan_profiles` or a join with `artisan_subscriptions`), larger profile images (handled by frontend based on `is_premium`), access to advanced analytics (admin dashboard feature).
    *   **Technical**: Artisans can initiate subscription via mobile money (e.g., USSD or direct debit). Admin manually confirms payment and updates `artisan_subscriptions` status. Backend logic filters search results to prioritize premium artisans. Admin Dashboard UI to manage plans and subscriptions.
*   **Featured Placements/Promoted Listings**:
    *   **Database Schema (`promoted_listings` table)**:
        ```sql
        CREATE TYPE listing_type AS ENUM ('profile', 'bid');
        CREATE TABLE promoted_listings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            listing_type listing_type NOT NULL,
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            payment_status VARCHAR(50), -- e.g., 'paid', 'pending'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ```
    *   **Technical**: Artisans pay a one-time fee (via mobile money, manually confirmed by admin) for a time-bound promotion. Backend queries `promoted_listings` to boost visibility in search results or job feeds. Admin UI to manage and approve promotions.
*   **Lead Generation Fees (Optional, Future)**:
    *   **Technical**: Requires tracking job views/inquiries per artisan. A micro-payment system would deduct a small fee from an artisan's internal wallet for each qualified lead. This is a more complex feature, best implemented after core payment integration.
*   **B2B Service Management (Future)**:
    *   **Technical**: Separate `companies` table, linking to `clients`. Enhanced admin dashboard features for managing corporate accounts, bulk job posting, and centralized billing. This would involve a separate subscription model for businesses.

## 6. Development Sprints

This section outlines a highly detailed, sprint-by-sprint technical plan. Each sprint is designed to deliver a cohesive set of features, building incrementally towards the full vision of HandyRwanda. Timeframes are indicative (e.g., 2 weeks per sprint) but flexible. Payment integration is strategically placed in the later sprints to ensure core functionality and user adoption are established first.

### Sprint 1: Core Infrastructure & User Authentication

**Goal**: Establish foundational backend services, database, and robust phone number-based user authentication for both client and artisan roles.

**Backend (FastAPI)**:
*   **Setup**: Initialize FastAPI project. Configure `uvicorn` for local development. Set up `Docker` for containerization. Integrate `SQLAlchemy` with `asyncpg` for async DB operations. Configure `Railway.app` for initial deployment (FastAPI, PostgreSQL, Redis).
*   **Database Schema (`users` table)**:
    ```sql
    CREATE TYPE user_role AS ENUM ('client', 'artisan', 'admin');
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        avatar_url TEXT,
        role user_role NOT NULL DEFAULT 'client',
        preferred_lang VARCHAR(10) NOT NULL DEFAULT 'en',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_users_phone_number ON users (phone_number);
    ```
*   **Authentication Endpoints (`/auth`)**:
    *   `POST /auth/otp/request`: Request OTP. Input: `{'phone_number': 'string'}`. Logic: Generate 6-digit OTP, store in Redis (`key: otp:{phone_number}`, `value: otp_code`, `TTL: 300s`). Call Africa's Talking SMS API. Output: `{'message': 'OTP sent'}`.
    *   `POST /auth/otp/verify`: Verify OTP and login/register. Input: `{'phone_number': 'string', 'otp_code': 'string', 'full_name': 'string' (optional for new users)}`. Logic: Check OTP in Redis. If valid, create user if not exists (default `role='client'`). Generate JWT access/refresh tokens. Output: `{'access_token': '...', 'refresh_token': '...', 'token_type': 'bearer'}`.
    *   `POST /auth/refresh`: Refresh access token. Input: `{'refresh_token': 'string'}`. Output: `{'access_token': '...', 'token_type': 'bearer'}`.
*   **User Management Endpoints (`/users`)**:
    *   `GET /users/me`: Get current user profile. Requires JWT. Output: `UserSchema`.
    *   `PUT /users/me`: Update current user profile. Input: `{'full_name': 'string', 'email': 'string', 'preferred_lang': 'string'}`. Requires JWT.
*   **Third-Party Integration**: Africa's Talking SDK for SMS. Redis for OTP storage.
*   **Testing**: Unit tests for all authentication and user management endpoints. Integration tests for OTP flow.

**Mobile Frontend (React Native - Expo)**:
*   **Setup**: Initialize Expo project (`npx create-expo-app --template tabs@51`). Configure `react-navigation` (Stack Navigator for auth, Tab Navigator for main app). Integrate `redux-toolkit` or `zustand` for auth state.
*   **Authentication UI**:
    *   `PhoneNumberInputScreen`: Input field for phone number. Button to send OTP. Calls `POST /auth/otp/request`.
    *   `OTPScreen`: Input field for OTP. Button to verify. Calls `POST /auth/otp/verify`. Handles new user registration (collects `full_name`).
    *   `RegistrationScreen`: (If user is new) Input for `full_name`, optional `email`. Calls `POST /auth/otp/verify` with `full_name`.
*   **User Profile UI**:
    *   `ProfileScreen`: Displays user's `full_name`, `phone_number`, `email`. Button to edit. Calls `GET /users/me` and `PUT /users/me`.
*   **Internationalization**: Implement `expo-localization` and `i18n-js`. Create `en.json` and `rw.json` translation files for core auth/profile strings.
*   **Deployment**: Initial build and deployment to Expo Go for testing. EAS build for Android/iOS development builds.

**Web Frontend (Next.js - Admin Dashboard)**:
*   **Setup**: Initialize Next.js project (`npx create-next-app@latest --typescript --tailwind --app`). Configure `next-auth` for basic admin login (e.g., credentials provider with hardcoded admin user for initial phase).
*   **Admin Login UI**: Simple login page with username/password. Authenticates against a basic admin user stored in environment variables or a simple DB entry.

### Sprint 2: Artisan Onboarding & Service Categories

**Goal**: Enable artisans to create detailed profiles, define service categories, and establish the initial verification process.

**Backend (FastAPI)**:
*   **Database Schema (`artisan_profiles`, `categories`, `artisan_skills` tables)**:
    ```sql
    CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
    CREATE TABLE artisan_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        years_experience INTEGER,
        service_radius_km INTEGER,
        location GEOGRAPHY(POINT, 4326),
        location_label VARCHAR(255), -- Human-readable address
        verification_status verification_status NOT NULL DEFAULT 'unverified',
        national_id_number VARCHAR(50) UNIQUE,
        national_id_doc_url TEXT, -- Cloudinary URL
        selfie_url TEXT, -- Cloudinary URL
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        average_rating NUMERIC(2,1) DEFAULT 0.0,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_artisan_location ON artisan_profiles USING GIST (location);
    CREATE INDEX idx_artisan_verification_status ON artisan_profiles (verification_status);

    CREATE TABLE categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE artisan_skills (
        artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        PRIMARY KEY (artisan_id, category_id)
    );
    ```
*   **Artisan Profile Endpoints (`/artisans`)**:
    *   `POST /artisans/profile`: Create/update artisan profile. Input: `{'bio': 'text', 'years_experience': 'int', 'service_radius_km': 'int', 'latitude': 'float', 'longitude': 'float', 'location_label': 'string', 'national_id_number': 'string', 'national_id_doc_base64': 'string', 'selfie_base64': 'string'}`. Logic: Upload base64 images to Cloudinary, store URLs. Set `verification_status='pending'`. Requires JWT (artisan role).
    *   `GET /artisans/profile/me`: Get current artisan profile. Requires JWT. Output: `ArtisanProfileSchema`.
    *   `PUT /artisans/profile/me/availability`: Toggle `is_available`. Input: `{'is_available': 'boolean'}`.
*   **Category Endpoints (`/categories`)**:
    *   `GET /categories`: List all active categories. Output: `List[CategorySchema]`.
*   **Artisan Skills Endpoints (`/artisans/skills`)**:
    *   `POST /artisans/skills`: Add skills. Input: `{'category_ids': 'List[UUID]'}`. Requires JWT (artisan role).
    *   `DELETE /artisans/skills/{category_id}`: Remove skill. Requires JWT.
*   **Third-Party Integration**: Cloudinary for image storage.
*   **Testing**: Unit tests for artisan profile CRUD, category listing, skill management. Integration tests for image upload to Cloudinary.

**Mobile Frontend (React Native - Expo)**:
*   **Artisan Onboarding UI (Artisan App)**:
    *   `ArtisanProfileSetupScreen`: Multi-step form for `bio`, `years_experience`, `service_radius_km`. Uses `react-native-maps` for location selection (pin drop, search). Collects `national_id_number`. Uses `expo-image-picker` for `national_id_doc_base64` and `selfie_base64` uploads. Calls `POST /artisans/profile`.
    *   `CategorySelectionScreen`: Displays categories from `GET /categories`. Allows multi-selection. Calls `POST /artisans/skills`.
*   **Client Home Screen (Client App)**:
    *   `HomeScreen`: Displays a grid/list of service categories (from `GET /categories`). Tapping a category navigates to `ArtisanListScreen`.
*   **Artisan Profile View (Client App)**:
    *   `ArtisanDetailScreen`: Displays detailed artisan profile (bio, experience, skills, location_label, `verification_status` badge). Fetches data from `GET /artisans/{user_id}/profile`.
*   **Image Upload**: Integrate `expo-image-picker` and `expo-camera` for capturing/selecting images, converting to base64 for API upload.

**Web Frontend (Next.js - Admin Dashboard)**:
*   **Artisan Verification Dashboard**:
    *   **Screen**: `AdminArtisanVerificationPage`. Displays a table of artisans with `verification_status='pending'`. Each row shows artisan details, `national_id_doc_url` (clickable to view image), `selfie_url` (clickable). Buttons to approve (`POST /admin/artisans/{user_id}/verify`) or reject (`POST /admin/artisans/{user_id}/reject`).

### Sprint 3: Job Posting & Basic Matching

**Goal**: Enable clients to post jobs with detailed requirements and allow artisans to discover and view relevant job opportunities.

**Backend (FastAPI)**:
*   **Database Schema (`jobs` table)**:
    ```sql
    CREATE TYPE job_status AS ENUM (
        'open', 'pending_bid_acceptance', 'booked', 'in_progress',
        'completed', 'cancelled', 'disputed'
    );
    CREATE TABLE jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        location_label VARCHAR(255) NOT NULL,
        scheduled_time TIMESTAMP WITH TIME ZONE,
        budget NUMERIC(10, 2), -- Optional, client can suggest
        status job_status NOT NULL DEFAULT 'open',
        photos_urls TEXT[], -- Array of Cloudinary URLs
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_jobs_location ON jobs USING GIST (location);
    CREATE INDEX idx_jobs_status ON jobs (status);
    CREATE INDEX idx_jobs_client_id ON jobs (client_id);
    ```
*   **Job Posting Endpoints (`/jobs`)**:
    *   `POST /jobs`: Client creates a new job. Input: `JobCreateSchema` (includes `category_id`, `title`, `description`, `latitude`, `longitude`, `location_label`, `scheduled_time`, `budget`, `photos_base64: List[str]`). Logic: Upload `photos_base64` to Cloudinary, store URLs in `photos_urls`. Set `status='open'`. Triggers a background task (Celery) to notify relevant artisans (those with matching skills and within service radius).
    *   `GET /jobs/{job_id}`: Retrieve a specific job detail. Output: `JobDetailSchema`.
*   **Job Search Endpoints (`/jobs`)**:
    *   `GET /jobs/available`: Artisans query for available jobs. Input: `category_id` (optional), `latitude`, `longitude` (for artisan's current location). Logic: Filters by `status='open'`, `category_id` (if provided), and `ST_DWithin(jobs.location, ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, artisan_profile.service_radius_km * 1000)`. Returns paginated results, ordered by proximity.
*   **Testing**: Unit tests for job creation and retrieval. Integration tests for geo-spatial job matching and Cloudinary photo uploads.

**Mobile Frontend (React Native - Expo)**:
*   **Job Posting UI (Client App)**:
    *   `JobPostScreen`: Multi-step form for job details. Includes:
        *   Text inputs for `title`, `description`.
        *   Category picker (fetches from `GET /categories`).
        *   Location picker using `react-native-maps` (auto-detect current location, allow manual pin drop/search, display `location_label`).
        *   Date/time picker for `scheduled_time`.
        *   Optional budget input.
        *   `expo-image-picker` for `photos_base64` uploads.
    *   Calls `POST /jobs` on submission.
*   **Artisan Job Feed (Artisan App)**:
    *   `JobFeedScreen`: Displays a list of available jobs (fetched from `GET /jobs/available`). Each job card shows `title`, `description`, `location_label`, distance from artisan, `scheduled_time`, `budget`.
    *   Tapping a job card navigates to `JobDetailScreen`.
*   **Job Detail View (Client & Artisan Apps)**:
    *   `JobDetailScreen`: Displays full job details, including photos, map view of job location. For artisans, includes a button to "Submit Bid".

### Sprint 4: Booking & Real-time Updates

**Goal**: Implement the core booking flow, including bidding, acceptance, and real-time status updates for both clients and artisans.

**Backend (FastAPI)**:
*   **Database Schema (`bids` table)**:
    ```sql
    CREATE TYPE bid_status AS ENUM (
        'pending', 'accepted', 'rejected', 'withdrawn'
    );
    CREATE TABLE bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
        proposed_price NUMERIC(10, 2) NOT NULL,
        message TEXT,
        status bid_status NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_bids_job_id ON bids (job_id);
    CREATE INDEX idx_bids_artisan_id ON bids (artisan_id);
    ```
*   **Database Schema (`bookings` table)**:
    ```sql
    CREATE TYPE booking_status AS ENUM (
        'pending_payment', 'confirmed', 'en_route', 'in_progress',
        'completed', 'cancelled', 'disputed'
    );
    CREATE TABLE bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agreed_price NUMERIC(10, 2) NOT NULL,
        status booking_status NOT NULL DEFAULT 'pending_payment',
        scheduled_time TIMESTAMP WITH TIME ZONE,
        start_time TIMESTAMP WITH TIME ZONE,
        end_time TIMESTAMP WITH TIME ZONE,
        cancellation_reason TEXT,
        dispute_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_bookings_artisan_id ON bookings (artisan_id);
    CREATE INDEX idx_bookings_client_id ON bookings (client_id);
    CREATE INDEX idx_bookings_status ON bookings (status);
    ```
*   **Bidding Endpoints (`/bids`)**:
    *   `POST /jobs/{job_id}/bids`: Artisan submits a bid. Input: `BidCreateSchema` (`proposed_price`, `message`). Logic: Creates `bid` entry. Sends push notification to client about new bid. Requires JWT (artisan role).
    *   `GET /jobs/{job_id}/bids`: Client views all bids for their job. Output: `List[BidSchema]`. Requires JWT (client role, owner of job).
    *   `POST /bids/{bid_id}/accept`: Client accepts a bid. Logic: Updates `bid.status` to 'accepted'. Updates `job.status` to 'pending_bid_acceptance'. Creates a `booking` entry with `status='pending_payment'` (payment integration in later sprint). Sends push notifications to both artisan (bid accepted) and client (booking created). Requires JWT (client role).
    *   `POST /bids/{bid_id}/reject`: Client rejects a bid. Logic: Updates `bid.status` to 'rejected'. Sends push notification to artisan (bid rejected). Requires JWT (client role).
*   **Booking Management Endpoints (`/bookings`)**:
    *   `GET /bookings/client`: Lists all bookings for the current client. Output: `List[BookingSchema]`.
    *   `GET /bookings/artisan`: Lists all bookings for the current artisan. Output: `List[BookingSchema]`.
    *   `GET /bookings/{booking_id}`: Retrieve a specific booking detail. Output: `BookingDetailSchema`.
    *   `POST /bookings/{booking_id}/start`: Artisan marks job as started. Logic: Updates `booking.status` to 'in_progress', sets `start_time`. Sends push notification to client. Requires JWT (artisan role, owner of booking).
    *   `POST /bookings/{booking_id}/complete`: Artisan marks job as completed. Logic: Updates `booking.status` to 'completed', sets `end_time`. Sends push notification to client (job completed, awaiting confirmation). Requires JWT (artisan role, owner of booking).
    *   `POST /bookings/{booking_id}/confirm_completion`: Client confirms job completion. Logic: Updates `booking.status` to 'completed'. (Payment release logic will be added here in Sprint 8). Sends push notification to artisan. Requires JWT (client role, owner of booking).
    *   `POST /bookings/{booking_id}/cancel`: Client/Artisan cancels booking. Input: `CancellationSchema` (`reason`). Logic: Updates `booking.status` to 'cancelled', sets `cancellation_reason`. Sends push notification to other party. Requires JWT (owner of booking).
    *   `POST /bookings/{booking_id}/dispute`: Client/Artisan raises dispute. Input: `DisputeSchema` (`reason`). Logic: Updates `booking.status` to 'disputed', sets `dispute_reason`. Sends push notification to other party and admin. Requires JWT (owner of booking).
*   **Real-time Updates (WebSockets)**:
    *   `GET /ws/{user_id}`: WebSocket endpoint. Logic: On connection, associates `user_id` with the WebSocket. FastAPI subscribes to a Redis Pub/Sub channel (`booking_updates:{user_id}`). When a booking status changes (e.g., via `POST /bookings/{booking_id}/start`), FastAPI publishes an update message to the relevant Redis channel. The WebSocket listener receives this and sends the update to the connected client.
*   **Push Notifications**: Integrate Expo Push Notifications. FastAPI sends requests to Expo API for events like new bid, bid accepted, job started, job completed, cancellation, dispute.
*   **Testing**: Unit tests for all bidding and booking endpoints. Integration tests for WebSocket real-time updates and push notifications.

**Mobile Frontend (React Native - Expo)**:
*   **Bid Submission UI (Artisan App)**:
    *   `JobDetailScreen`: Includes a form to "Submit Bid" with `proposed_price` and `message` inputs. Calls `POST /jobs/{job_id}/bids`.
*   **Booking Confirmation UI (Client App)**:
    *   `JobDetailScreen`: Displays a list of bids for the job. Each bid shows artisan details, `proposed_price`, `message`. Buttons to "Accept Bid" (calls `POST /bids/{bid_id}/accept`) or "Reject Bid" (calls `POST /bids/{bid_id}/reject`).
*   **Real-time Status Display (Client & Artisan Apps)**:
    *   `BookingDetailScreen`: Connects to the WebSocket endpoint (`/ws/{user_id}`). Displays live updates for `booking.status`. Buttons to "Start Job", "Complete Job" (Artisan), "Confirm Completion" (Client), "Cancel", "Dispute".
*   **Push Notification Handling**: Configure `expo-notifications` to receive and display push notifications. On tap, navigate to the relevant `BookingDetailScreen`.

### Sprint 5: In-App Chat & Reviews

**Goal**: Enable direct, secure communication between clients and artisans post-booking, and implement a robust review and rating system.

**Backend (FastAPI)**:
*   **Database Schema (`messages` table)**:
    ```sql
    CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_messages_booking_id ON messages (booking_id);
    ```
*   **Database Schema (`reviews` table)**:
    ```sql
    CREATE TABLE reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booking_id UUID UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_reviews_artisan_id ON reviews (artisan_id);
    ```
*   **Chat Endpoints (`/bookings/{booking_id}/messages`)**:
    *   `GET /bookings/{booking_id}/messages`: Retrieves chat history for a specific booking. Output: `List[MessageSchema]`. Requires JWT (participant in booking).
    *   `POST /bookings/{booking_id}/messages`: Sends a new message. Input: `MessageCreateSchema` (`content`). Logic: Stores message in `messages` table. Publishes message to Redis Pub/Sub channel (`chat:{booking_id}`) for real-time delivery via WebSockets. Sends push notification to the other party.
*   **Review Endpoints (`/bookings/{booking_id}/review`)**:
    *   `POST /bookings/{booking_id}/review`: Client submits a review for a completed booking. Input: `ReviewCreateSchema` (`rating`, `comment`). Logic: Validates `booking.status` is 'completed' and no existing review for this `booking_id`. Creates `review` entry. Triggers a background task (Celery) to recalculate `artisan_profiles.average_rating` and `total_reviews` for the artisan. Requires JWT (client role, owner of booking).
*   **Artisan Rating Aggregation**: A Celery task or database trigger that updates `artisan_profiles.average_rating` and `total_reviews` whenever a new review is submitted or an existing one is modified/deleted.
*   **Testing**: Unit tests for chat message storage and retrieval. Integration tests for real-time chat via WebSockets. Unit tests for review submission and rating aggregation logic.

**Mobile Frontend (React Native - Expo)**:
*   **In-App Chat UI (Client & Artisan Apps)**:
    *   `ChatScreen`: Accessible from `BookingDetailScreen`. Displays messages in a conversational UI. Connects to WebSocket for real-time message sending/receiving. Text input for new messages.
*   **Review Submission UI (Client App)**:
    *   `ReviewScreen`: Appears after client confirms job completion. Star rating component (1-5 stars). Text area for `comment`. Calls `POST /bookings/{booking_id}/review`.
*   **Artisan Profile Update**: Artisan profiles (`ArtisanDetailScreen`) display the aggregated `average_rating` and `total_reviews`.

### Sprint 6: Admin Dashboard Enhancements & Monetization Setup

**Goal**: Enhance administrative capabilities for platform management and lay the groundwork for initial monetization features.

**Backend (FastAPI)**:
*   **Admin APIs (Protected by `admin` role)**:
    *   **User Management**: `GET /admin/users` (list all users), `GET /admin/users/{user_id}` (get user details), `PUT /admin/users/{user_id}` (update user details, e.g., role, active status), `DELETE /admin/users/{user_id}` (soft delete/ban user).
    *   **Job Management**: `GET /admin/jobs` (list all jobs), `PUT /admin/jobs/{job_id}/status` (update job status, e.g., cancel).
    *   **Dispute Resolution**: `GET /admin/disputes` (list all disputed bookings), `GET /admin/disputes/{booking_id}` (get dispute details), `POST /admin/disputes/{booking_id}/resolve` (resolve dispute, input: `resolution_details`, `resolved_by_admin_id`).
    *   **Analytics Endpoints**: `GET /admin/analytics/summary` (returns aggregated data: total users, active artisans, completed jobs, total revenue (calculated from commissions)).
    *   **Broadcast Tool**: `POST /admin/notifications/broadcast` (input: `message`, `target_roles: List[user_role]`). Logic: Sends push notifications via Expo API and SMS via Africa's Talking to targeted users.
*   **Monetization Logic**: Implement logic for commission calculation on job completion (already partially done in Sprint 5, now ensure it's robust). Define API for managing premium artisan subscriptions.
    *   **Database Schema (`subscription_plans` table)**:
        ```sql
        CREATE TABLE subscription_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) UNIQUE NOT NULL,
            price NUMERIC(10, 2) NOT NULL,
            duration_days INTEGER NOT NULL,
            features JSONB -- e.g., {"featured_placement": true, "analytics_access": true}
        );
        ```
    *   **Database Schema (`artisan_subscriptions` table)**:
        ```sql
        CREATE TYPE subscription_status AS ENUM (
            'active', 'inactive', 'cancelled', 'expired'
        );
        CREATE TABLE artisan_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            artisan_id UUID NOT NULL REFERENCES artisan_profiles(user_id) ON DELETE CASCADE,
            plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            status subscription_status NOT NULL DEFAULT 'active',
            payment_reference VARCHAR(255), -- For manual/mobile money payments
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ```
    *   **Subscription Endpoints (Admin)**:
        *   `POST /admin/subscription_plans`: Create new subscription plan.
        *   `PUT /admin/subscription_plans/{plan_id}`: Update plan.
        *   `POST /admin/artisans/{user_id}/subscribe`: Manually assign/activate a subscription for an artisan (for initial mobile money payments).
*   **Testing**: Unit and integration tests for all admin APIs. Test monetization logic for commission calculation and subscription management.

**Web Frontend (Next.js - Admin Dashboard)**:
*   **UI Framework**: Use `shadcn/ui` or similar component library for consistent and accessible UI.
*   **User Management UI**: Dedicated pages for listing, searching, viewing, and editing user/artisan profiles. Buttons for banning/unbanning.
*   **Job Management UI**: Page to list all jobs, filter by status, view details, and manually change status (e.g., cancel).
*   **Dispute Resolution UI**: Page to list disputed bookings. Each dispute shows booking details, client/artisan info, dispute reason. Form to enter resolution details and mark as resolved.
*   **Basic Analytics Display**: Dashboard page with charts (`chart.js` or `recharts`) showing total users, active artisans, completed jobs, and calculated revenue.
*   **Subscription Management UI**: Pages to create/edit `subscription_plans`. Page to view and manage `artisan_subscriptions`, including manual activation/deactivation.
*   **Broadcast Tool UI**: Form to compose a message and select target roles (clients, artisans, all) for sending notifications.

### Sprint 7: Advanced Features & Performance

**Goal**: Implement advanced features for enhanced user experience, optimize platform performance, and prepare for future growth.

**Backend (FastAPI)**:
*   **Search Optimization**: Implement Redis caching for frequently accessed artisan search queries (e.g., artisans by category and location). Logic: Cache results of `GET /artisans/search` for a short TTL (e.g., 5 minutes). Invalidate cache on artisan profile updates.
*   **Rate Limiting**: Implement API rate limiting using Redis (e.g., `redis-py-rate-limiter` or custom middleware) to protect against abuse and ensure fair usage.
*   **Offline Sync Endpoints**: Provide idempotent API endpoints specifically designed for mobile app's background synchronization. E.g., `POST /sync/jobs` (batch update job statuses), `POST /sync/messages` (batch send messages).
*   **Referral System API**: 
    *   **Database Schema (`referrals` table)**:
        ```sql
        CREATE TABLE referrals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referred_user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            referral_code VARCHAR(20) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending', -- e.g., 'pending', 'registered', 'qualified'
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_referrals_referrer_id ON referrals (referrer_id);
        CREATE INDEX idx_referrals_referred_user_id ON referrals (referred_user_id);
        ```
    *   **Endpoints**: `GET /users/me/referral_code` (generate/retrieve user's unique code). `POST /auth/register` (modified to accept `referral_code`). Logic: When a new user registers with a `referral_code`, create an entry in `referrals` table. Implement logic to track when referred users become "qualified" (e.g., complete first job).
*   **Testing**: Performance testing for search and API endpoints under load. Security testing for rate limiting. Integration tests for referral system.

**Mobile Frontend (React Native - Expo)**:
*   **Offline Data Sync**: Implement background synchronization logic using `expo-task-manager` or `react-native-background-fetch`. Queue offline actions and send them to backend via dedicated sync endpoints when online.
*   **Enhanced Search**: Integrate Redis-backed search for faster results. Implement debounce for search inputs.
*   **Referral UI**: 
    *   `ReferralScreen`: Displays user's unique referral code. Options to share code. Displays status of referred users.
    *   `RegistrationScreen`: Includes an optional input field for a referral code.
*   **Performance Optimization**: 
    *   Image optimization: Use `expo-image` for efficient image loading and caching. Implement lazy loading for lists and images.
    *   Bundle size reduction: Analyze and optimize app bundle size using Expo tools.
    *   UI/UX polish: Ensure smooth animations, transitions, and responsiveness.

**Web Frontend (Next.js - Admin)**:
*   **Advanced Analytics**: More detailed dashboards for user engagement, job trends, and referral tracking. Visualizations for conversion rates from referral.

### Sprint 8: Payment Integration & Final Polish

**Goal**: Fully integrate MTN MoMo and Airtel Money for secure escrow payments, automate commission deductions, and conduct final testing and polish before launch.

**Backend (FastAPI)**:
*   **Payment Integration (MTN MoMo & Airtel Money)**:
    *   **Technical**: Integrate with MTN MoMo API and Airtel Money API. This typically involves:
        *   **Client Payments (Collections)**: API endpoint `POST /payments/initiate` (input: `booking_id`, `amount`, `phone_number`). Logic: Calls mobile money API to initiate a payment request to the client's phone. Updates `booking.status` to 'pending_payment'. Records transaction in `transactions` table.
        *   **Webhooks/Callbacks**: Implement webhook endpoints (`POST /payments/mtn_momo/callback`, `POST /payments/airtel_money/callback`) to receive payment confirmation from mobile money providers. Logic: On successful payment, updates `booking.status` to 'confirmed'. Sends push notification to artisan (booking confirmed).
        *   **Artisan Payouts (Disbursements)**: API endpoint `POST /payments/payout` (triggered by `POST /bookings/{booking_id}/confirm_completion` or a scheduled task). Logic: Calculates artisan's net earnings (`agreed_price - commission`). Calls mobile money API to disburse funds to artisan's phone number. Records transaction in `transactions` table.
        *   **Refunds**: API endpoint `POST /payments/refund` (triggered by admin or dispute resolution). Logic: Calls mobile money API to refund client. Records transaction.
    *   **Database Schema (`transactions` table)**:
        ```sql
        CREATE TYPE transaction_type AS ENUM (
            'payment_in', 'payout_out', 'commission_deduction', 'refund'
        );
        CREATE TYPE transaction_status AS ENUM (
            'pending', 'success', 'failed'
        );
        CREATE TABLE transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type transaction_type NOT NULL,
            amount NUMERIC(10, 2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'RWF',
            status transaction_status NOT NULL DEFAULT 'pending',
            reference_id VARCHAR(255), -- Mobile money transaction ID
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_transactions_user_id ON transactions (user_id);
        CREATE INDEX idx_transactions_booking_id ON transactions (booking_id);
        ```
*   **Monetization Enforcement**: Integrate commission deduction directly into the payment release logic. When a payout is initiated, the commission is automatically deducted and recorded as a `commission_deduction` transaction for the platform.
*   **Security Hardening**: Implement robust security measures for storing API keys and credentials (e.g., environment variables, secrets management service). Ensure all payment-related communications are encrypted.
*   **Testing**: Comprehensive end-to-end testing of all payment flows (initiation, confirmation, payout, refund). Security audits for payment endpoints.

**Mobile Frontend (React Native - Expo)**:
*   **Payment UI (Client App)**:
    *   `PaymentScreen`: Appears after client accepts a bid. Displays `agreed_price`. Options to select MTN MoMo or Airtel Money. Input for phone number (pre-filled). Calls `POST /payments/initiate`. Displays payment status updates.
*   **Payout UI (Artisan App)**:
    *   `EarningsScreen`: Displays current earnings. Button to "Initiate Payout". Input for desired payout amount and mobile money number. Calls `POST /payments/payout`.
*   **Transaction History (Client & Artisan Apps)**:
    *   `TransactionHistoryScreen`: Lists all `transactions` for the user, showing `type`, `amount`, `status`, `description`.
*   **Final UI/UX Polish**: Address any remaining UI/UX issues, ensure smooth animations and transitions, accessibility checks.

**Web Frontend (Next.js - Admin)**:
*   **Payment Reconciliation**: Admin interface to view and reconcile all `transactions`. Filter by type, status, user, booking. Tools to manually trigger payouts or refunds if needed.
*   **Monetization Reporting**: Detailed reports on commissions, subscriptions, and promoted listings revenue, leveraging the `transactions` and `artisan_subscriptions` tables.

## 7. Future Enhancements & Viral Growth Strategies

Beyond the initial sprints, several features can drive viral growth and further monetization, building on the established technical foundation:

*   **USSD Interface**: For feature phones, enabling broader access in low-smartphone penetration areas.
    *   **Technical**: Integrate Africa's Talking USSD API. Design simple menu-driven interactions for job posting, artisan search, and booking status checks. Backend logic to translate USSD inputs to API calls.
*   **Corporate/B2B Accounts**: Dedicated features for businesses to manage multiple service requests, recurring bookings, and invoicing.
    *   **Technical**: Implement `companies` table (`id`, `name`, `contact_person_id`, `billing_info`). Link `clients` to `companies`. Enhanced admin dashboard features for managing corporate accounts, bulk job posting, and centralized billing. Separate subscription model for businesses.
*   **Artisan Certification Badges**: Partner with vocational training centers (TVETs) to offer official badges, enhancing trust and artisan quality.
    *   **Technical**: `certifications` table (`id`, `name`, `issuer`, `issue_date`). `artisan_certifications` junction table. Admin UI to manage and verify certifications. Display badges on artisan profiles.
*   **Dynamic Pricing Suggestions (AI-assisted)**: Suggest optimal pricing for services based on demand, location, time of day, and artisan ratings.
    *   **Technical**: Develop a machine learning model (e.g., using Python libraries like `scikit-learn` or `TensorFlow`) that analyzes historical job data (`jobs`, `bookings`, `reviews`). Integrate model as a microservice or a FastAPI endpoint (`GET /jobs/suggested_price`).
*   **Repeat Booking / Favorite Artisan Feature**: Allow clients to easily re-book previous artisans or mark them as favorites.
    *   **Technical**: `favorite_artisans` table (`client_id`, `artisan_id`). Backend endpoint `POST /users/me/favorites/{artisan_id}`. Frontend UI to display favorite artisans and initiate repeat bookings.
*   **In-App Wallet & Loyalty Program**: A digital wallet for users to store funds and a loyalty program to reward frequent usage.
    *   **Technical**: `wallets` table (`user_id`, `balance`). `loyalty_points` table (`user_id`, `points`). Integration with payment gateways for wallet top-ups. Backend logic for earning/redeeming points based on job completion or referrals.
*   **Advanced Analytics for Artisans**: Provide artisans with insights into their performance, popular services, and earning potential.
    *   **Technical**: Dedicated artisan dashboard with charts and reports (e.g., earnings over time, job acceptance rate, average rating breakdown). FastAPI endpoints for artisan-specific analytics data.
*   **Community Features**: Forums or groups for artisans to share knowledge and best practices.
    *   **Technical**: Separate forum module, potentially using a lightweight forum library or building custom. Integration with existing user authentication. Database tables for `posts`, `comments`, `topics`.
*   **Partnerships**: Integrate with local businesses (e.g., hardware stores) for exclusive discounts for HandyRwanda users.
    *   **Technical**: `partnerships` table (`id`, `name`, `description`, `logo_url`). `discounts` table (`partner_id`, `code`, `percentage`, `expiry_date`). API for applying discounts during booking.

## 8. Conclusion

This highly detailed technical blueprint provides a rigorous roadmap for developing HandyRwanda into a leading home services marketplace. By meticulously outlining the architecture, feature specifications, and sprint-by-sprint implementation details, the platform is poised for robust development, scalable growth, and sustainable monetization. The strategic placement of payment integration in the final sprint ensures that core functionality and user trust are established first, paving the way for a successful launch and expansion across Rwanda and beyond.

---

**Date**: May 23, 2026