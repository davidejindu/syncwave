# SyncWave 

**Distributed YouTube-to-Spotify playlist migration system with async queue processing and intelligent fuzzy matching**

> SyncWave migrates YouTube playlists to Spotify using an asynchronous, queue-based architecture.  
> Jobs are processed in the background while users receive real-time progress updates.

---

Demo

▶ Watch the full demo:  
https://www.youtube.com/watch?v=H2nwC8Jz3JQ

---

## What It Does

SyncWave migrates YouTube playlists to Spotify without forcing users to wait 30+ seconds for processing.

Instead of synchronous execution, playlist migrations are queued and processed asynchronously while users can track progress in real time.

### Key Features

- OAuth 2.0 authentication with Spotify  
- Async processing using **AWS SQS + Lambda workers**  
- Multi-factor fuzzy matching (title + artist + duration)  
- DynamoDB result caching for performance  
- Real-time progress tracking  
- Automatic token refresh  

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    USER (Browser)                            │
│                                                             │
│  1. Login via Spotify OAuth                                  │
│  2. Submit YouTube playlist URL                              │
│  3. Poll for real-time progress (every 2s)                   │
│  4. View results + Spotify link                              │
└─────────────────────────────────────────────────────────────┘
                         ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      NEXT.JS API                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Dashboard   │  │  API Routes  │                         │
│  │  (React)     │  │              │                         │
│  │              │  │ /jobs/submit │                         │
│  │ - Form       │  │ /jobs/[id]   │                         │
│  │ - Progress   │  │ /jobs/list   │                         │
│  │ - Results    │  │              │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                         ↓
                   ┌─────────────┐
                   │  AWS SQS    │
                   │   Queue     │
                   │ Job Messages│
                   └─────────────┘
                         ↓
                ┌───────────────────┐
                │   AWS Lambda      │
                │   Worker Runtime  │
                │                   │
                │ - Process jobs    │
                │ - Match songs     │
                │ - Update progress │
                │ - Cache results   │
                └───────────────────┘
                         ↓
               ┌──────────────┐
               │  DynamoDB    │
               │ Jobs + Cache │
               └──────────────┘
                         ↓
        ┌──────────────┐        ┌──────────────┐
        │ Spotify API  │        │ YouTube API  │
        │              │        │              │
        └──────────────┘        └──────────────┘
