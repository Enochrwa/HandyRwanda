# Socket.IO Migration Guide

## Overview

HandyRwanda has been upgraded from raw WebSockets to **Socket.IO** across the
entire stack (backend, web, mobile).  This document describes the changes made,
the new architecture, and how to connect from client code.

---

## Why Socket.IO?

| Feature | Raw WebSocket | Socket.IO |
|---|---|---|
| Auto-reconnect | Manual | Built-in exponential back-off |
| Rooms / namespaces | Custom code | First-class primitives |
| Transport fallback | No | WS → HTTP long-polling |
| Auth in handshake | Custom | `auth` object |
| Ping/pong keepalive | Manual | Built-in (configurable) |
| Event-based API | Manual parse | `socket.on("event", fn)` |
| React Native compat | Fragile | Stable (polling fallback) |

---

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │        python-socketio ASGI App           │
                         │  (wraps FastAPI; intercepts /socket.io/*)  │
                         │                                            │
                         │   Namespace: /notifications               │
                         │     Room:    "user:{user_id}"             │
                         │                                            │
                         │   Namespace: /messages                    │
                         │     Room:    "booking:{booking_id}"       │
                         └──────────────────────────────────────────┘
                                       ▲
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
    Web (socket.io-client)   Mobile (socket.io-client)    Other services
    /notifications             /notifications              push_notification()
    /messages                  /messages                   broadcast_message()
```

---

## Server Entry-Point

**Before:** `uvicorn app.main:app`
**After:**  `uvicorn app.main:application`

The `application` object is the combined `socketio.ASGIApp` + FastAPI.
`server.py` is already updated.

---

## Namespaces and Events

### `/notifications` namespace

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `notification` | `{ type: "notification", data: { id, event_type, title, body, payload, is_read, created_at } }` |
| Server → Client | `connected` | `{ user_id }` |
| Server → Client | `pong` | `{}` |
| Client → Server | `ping` | — |

**Connection auth:**
```js
const socket = io(`${API_BASE}/notifications`, {
  auth: { token: "<jwt>" },
  transports: ["websocket", "polling"],
  path: "/socket.io",
});
```

### `/messages` namespace

| Direction | Event | Payload |
|---|---|---|
| Server → Client | `message` | Full message dict `{ id, booking_id, sender_id, content, ... }` |
| Server → Client | `connected` | `{ booking_id }` |
| Server → Client | `joined` | `{ booking_id }` |
| Server → Client | `pong` | `{}` |
| Client → Server | `join` | `{ booking_id }` |
| Client → Server | `leave` | `{ booking_id }` |
| Client → Server | `ping` | — |

**Connection auth:**
```js
const socket = io(`${API_BASE}/messages`, {
  auth: { token: "<jwt>", booking_id: "<uuid>" },
  transports: ["websocket", "polling"],
  path: "/socket.io",
});
```

---

## Files Changed

### Backend
| File | Change |
|---|---|
| `backend/app/integrations/socket_manager.py` | **NEW** — Socket.IO server, namespaces, rooms, helpers |
| `backend/app/integrations/ws_manager.py` | Shim — delegates to `socket_manager` (backward compat) |
| `backend/app/main.py` | Removed raw WS endpoints; mounts combined ASGI app |
| `backend/app/routers/notifications.py` | Uses `push_notification()` from `socket_manager` |
| `backend/app/routers/messages.py` | Calls `broadcast_message()` after persisting message |
| `backend/server.py` | `app.main:application` (not `app.main:app`) |
| `backend/requirements.txt` | Added `python-socketio[asyncio_client]>=5.11.0` |

### Web
| File | Change |
|---|---|
| `web/src/hooks/useNotificationSocket.ts` | Rewritten with `socket.io-client` |
| `web/src/hooks/useMessageSocket.ts` | **NEW** — dedicated messages socket hook |
| `web/src/routes/messages.tsx` | Uses `useMessageSocket`; removed raw WS code |
| `web/package.json` | Added `socket.io-client` |

### Mobile
| File | Change |
|---|---|
| `mobile/src/hooks/useNotificationSocket.ts` | Rewritten with `socket.io-client` |
| `mobile/src/hooks/useMessageSocket.ts` | **NEW** — dedicated messages socket hook |
| `mobile/app/messages/[bookingId].tsx` | Uses `useMessageSocket`; removed raw WS code |
| `mobile/metro.config.js` | Added `socket.io-client` to `extraNodeModules` |
| `mobile/package.json` | Added `socket.io-client`; updated jest transform patterns |

---

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py          # now serves app.main:application

# Web
cd web
npm install
npm run dev

# Mobile
cd mobile
npm install
npx expo start --dev-client
```
