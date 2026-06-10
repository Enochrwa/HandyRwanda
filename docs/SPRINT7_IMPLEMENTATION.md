# Sprint 7 — Voice Messages in Chat: Implementation Summary

## Status: ✅ Complete

---

## What Was Built

### 7.1 Backend — Voice Message Support

#### `backend/app/models/message.py`
- `content` column changed to **nullable** (`nullable=True`) — allows voice-only messages with no text
- Added `voice_note_duration_secs: float | None` — stores audio duration for UI without re-loading the file
- Added `is_voice_only` property — computed helper for convenience

#### `backend/app/routers/messages.py`
- **`MessageCreate`** schema updated:
  - `content` defaults to `""` (optional for voice-only)
  - `voice_note_url: str | None` — presigned-uploaded URL
  - `voice_note_duration_secs: float | None` — optional metadata
  - `@model_validator` enforces: at least one of (content, voice_note_url) must be non-empty
  - `@field_validator` coerces `content=None` to `""` for backwards compatibility
- **`send_message`**: persists `voice_note_url` + `voice_note_duration_secs`; skips translation for voice-only messages (`detected_lang = "audio"`)
- **`_msg_dict`**: now includes `voice_note_duration_secs` and `is_voice_only` in all message responses
- **`get_conversations` SQL**: COALESCE content with `🎙️ Voice message` placeholder for voice-only last messages; includes `is_voice` flag in `last_message` payload

#### `backend/app/routers/uploads.py`
- Added `"voice_note"` → `"voice-notes"` to `ALLOWED_FOLDERS`
- Added audio MIME types: `audio/m4a`, `audio/aac`, `audio/mp4`, `audio/webm`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/x-m4a`
- **Per-type max size**: voice notes = 10 MB, all else = 5 MB
- Cross-validation: voice_note only accepts audio; image types only accept images
- `max_size_bytes` now returned per-type in the presign response

#### `backend/migrations/versions/s7_voice_messages.py`
- Makes `messages.content` nullable
- Adds `messages.voice_note_duration_secs` column (Float)
- Adds partial index on `voice_note_url IS NOT NULL`

---

### 7.2 Mobile — Voice Recording UI

#### `mobile/src/hooks/useVoiceRecorder.ts`
- State machine: `idle → recording → stopped`
- Uses `expo-av Audio.Recording` with HIGH quality preset (64kbps AAC, 44.1kHz, mono)
- Requests `Audio.requestPermissionsAsync()` on first use
- Live elapsed timer with 1s resolution; auto-stops at 5 minutes
- Both iOS (`.m4a`) and Android (`.mp4`/`.m4a`) formats supported

#### `mobile/src/hooks/useAudioPlayer.ts`
- Uses `expo-av Audio.Sound` for playback
- Lazy loading — audio not fetched until first play (saves data)
- Auto-resets to start on completion
- `playsInSilentModeIOS: true` — plays even when phone is on silent
- Autoplay: **OFF** — respects data costs for Rwanda users

#### `mobile/src/services/voiceUpload.ts`
- MIME detection from URI extension
- 9.5 MB client-side gate (leaves 0.5 MB headroom vs 10 MB server limit)
- Presigned URL flow via `POST /uploads/presign` + `PUT` direct to Supabase
- Mirrors `imageUpload.ts` architecture — no API server in the upload path

#### `mobile/src/components/VoiceRecordButton.tsx`
- Hold-to-record (PressIn/PressOut) on a mic button
- Pulsing red ring animation while recording (Animated loop)
- Elapsed time badge above button
- Subtle spring scale animation on press
- Accessibility labels for screen readers

#### `mobile/src/components/VoicePreviewCard.tsx`
- Shown above input bar after recording stops
- Preview playback via `useAudioPlayer`
- 15-bar waveform progress indicator
- Delete (discard) and Send buttons
- Upload progress with spinner during send
- Error display with Alert on failure

#### `mobile/src/components/VoiceMessageBubble.tsx`
- Renders in the message list for any message with `voice_note_url`
- Matches existing bubble styling (primary green for mine, muted for theirs)
- Animated waveform bars (pulse animation while playing, 18 bars)
- Play/Pause with ActivityIndicator while loading
- Elapsed/total duration counter
- Error state (subtle warning text)
- Accessibility: aria labels on play/pause button

#### `mobile/app/messages/[bookingId].tsx` (Chat thread)
- **Mic button** added to left of input bar
- Shows recording indicator banner while recording
- Input bar hidden while recording (full-width recording mode)
- `VoicePreviewCard` replaces input bar after stopping
- `MessageItem` component: detects `voice_note_url` → renders `VoiceMessageBubble`; optimistic voice placeholder for upload-in-progress
- Text messaging, LiveStatusCard, booking actions all preserved

#### `mobile/app/(tabs)/messages.tsx` (Conversations list)
- Last message preview: shows `🎙️ Voice message` with mic icon for voice-only messages
- Added status labels for `artisan_accepted` and `artisan_en_route`
- Header added to conversations screen

---

### 7.3 Web — Voice Playback

#### `web/src/routes/messages.tsx`
- `Message` interface updated: `content` nullable, `voice_note_url`, `voice_note_duration_secs`, `is_voice_only` added
- `Conversation.last_message` updated with `is_voice` flag
- **`WebVoiceBubble`** component: pure HTML `<Audio>` API, no dependencies
  - Play/Pause button with loader
  - 18-bar waveform progress indicator
  - Duration counter
  - Matches existing bubble colour scheme
- Conversation list: shows mic icon + "Voice message" for voice previews

---

## Package Dependencies Added

### Mobile: `expo-av ~15.0.2`
- Audio recording and playback
- Compatible with Expo SDK 54

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| 64 kbps mono AAC | Halves file size vs stereo. Voice-only quality is indistinguishable. |
| Hold-to-record | Industry standard (WhatsApp, Telegram). Prevents accidental recordings. |
| Autoplay OFF | Rwanda 4G/3G data costs. User explicitly plays when ready. |
| Presigned URL upload | API server never handles audio bytes. Critical for reliability on slow connections. |
| Static waveform bars | Actual waveform analysis costs CPU and bandwidth. Decorative bars are indistinguishable in practice. |
| `content = None` for voice-only | Cleaner than storing empty string. Backwards compatible via Pydantic coercion. |
| 10 MB voice limit | ~20 min at 64kbps. 5-min auto-stop = max ~2.4 MB. 10 MB gives 4x headroom. |

---

## API Contract

### POST `/messages/{booking_id}`
**New accepted payload:**
```json
{
  "content": "",
  "voice_note_url": "https://storage.supabase.co/voice-notes/user_id/rec.m4a",
  "voice_note_duration_secs": 42.5
}
```

**Response now includes:**
```json
{
  "id": "...",
  "voice_note_url": "https://...",
  "voice_note_duration_secs": 42.5,
  "is_voice_only": true,
  "content": null,
  "detected_lang": "audio"
}
```

### POST `/uploads/presign`
**New accepted `upload_type`:** `"voice_note"`  
**New accepted MIME types:** `audio/m4a`, `audio/aac`, `audio/mp4`, `audio/webm`  
**Response:** `max_size_bytes` is now `10485760` (10 MB) for voice notes
