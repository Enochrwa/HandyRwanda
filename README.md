# HandyRwanda

HandyRwanda is a mobile-first, two-sided marketplace designed to connect verified skilled artisans—such as plumbers, electricians, painters, and carpenters—with households and businesses across Rwanda. Built specifically for the Rwandan market, it emphasizes trust, local payment integrations (MTN MoMo, Airtel Money), and low-bandwidth accessibility.

## 🚀 Key Features

- **Artisan Discovery & Booking:** Find, book, and pay vetted artisans in under 5 minutes.
- **Trust Infrastructure:** Escrow payment system, ID verification, and a verified review system.
- **Mobile-First Design:** Optimized for React Native with Kinyarwanda, English, and French support.
- **Offline Capability:** Cache-first architecture for low-connectivity environments.
- **Admin Dashboard:** Comprehensive tools for artisan verification and dispute resolution.

## 🛠 Tech Stack

### Monorepo Structure
This project is organized as a monorepo with three main workspaces:

- **`backend/`**: FastAPI (Python 3.11+) powered REST API.
- **`mobile/`**: React Native (Expo SDK 51+) application for iOS and Android.
- **`web/`**: TanStack Start (React) for the admin dashboard and public web pages.

### Core Technologies
| Layer | Technology |
|---|---|
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL + PostGIS, Redis |
| **Mobile** | React Native, Expo, Zustand, React Query |
| **Web** | TanStack Start, TanStack Router, Tailwind CSS, Radix UI |
| **Payments** | MTN MoMo API, Airtel Money API |
| **Auth** | JWT + OTP via Africa's Talking |
| **Storage** | Cloudinary (Media), PostgreSQL (Data) |

## 📁 Folder Structure

```text
.
├── backend/          # FastAPI application
├── mobile/           # React Native (Expo) app
├── web/              # TanStack Start web/admin
├── docs/             # Product blueprints and UI design specs
├── .husky/           # Git hooks
└── package.json      # Monorepo configuration and scripts
```

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.11+)
- Docker (for PostgreSQL and Redis)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/handyrwanda.git
   cd handyrwanda
   ```
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Setup workspaces:
   - **Backend:** `cd backend && pip install -r requirements.txt`
   - **Mobile:** `cd mobile && npm install`
   - **Web:** `cd web && npm install`

### Running the Project
From the root directory, you can use the following scripts:
- **Web Development:** `npm run dev`
- **Linting (All):** `npm run lint`
- **Formatting (All):** `npm run format`
- **Testing (All):** `npm run test`

## 🧪 Development Workflow

We use **Husky**, **lint-staged**, and **commitlint** to ensure code quality and follow conventional commits.

- **Linting:** `npm run lint`
- **Formatting:** `npm run format`
- **Testing:** `npm run test`
- **Type Checking:** `npm run type-check`

## 🎨 Design Philosophy
HandyRwanda's UI is built to build trust. It uses a warm palette (Deep Forest Green, Warm Amber) and elegant typography (Plus Jakarta Sans). For a detailed breakdown of the design system, refer to `docs/HandRwandaUI.md`.

## 📜 Documentation
For more detailed information, please see the `docs/` folder:
- [Developer Blueprint](docs/HandyRwanda.md)
- [UI Design Philosophy](docs/HandRwandaUI.md)

---
Built for Rwanda. Built for Africa. 🇷🇼
