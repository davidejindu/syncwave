# SyncWave 

**Distributed YouTube-to-Spotify playlist migration system with async queue processing and intelligent fuzzy matching**

> SyncWave migrates YouTube playlists to Spotify using an asynchronous, queue-based architecture.  
> Jobs are processed in the background while users receive real-time progress updates.

---
Demo

▶ Watch the full demo:
https://www.youtube.com/watch?v=H2nwC8Jz3JQ

---

## Key Metrics

- **91% match accuracy** across 1,000+ song migrations  
- **73% Spotify API call reduction** via DynamoDB result caching  
- **<200ms API response time** using async queue processing  
- **5× faster processing** for cached songs  

---

## What It Does

SyncWave migrates YouTube playlists to Spotify without forcing users to wait 30+ seconds for processing.

Instead of synchronous execution, playlist migrations are queued and processed asynchronously while users can track progress in real time.

### Key Features
- OAuth 2.0 authentication with Spotify  
- Async processing using AWS SQS queues  
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
│              NEXT.JS API + BACKGROUND WORKER                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  Dashboard   │  │  API Routes  │  │ Background Worker│  │
│  │  (React)     │  │              │  │ (Continuous Poll)│  │
│  │              │  │ /jobs/submit │  │                  │  │
│  │ - Form       │  │ /jobs/[id]   │  │ - Poll SQS       │  │
│  │ - Progress   │  │ /jobs/list   │  │ - Match songs    │  │
│  │ - Results    │  │              │  │ - Cache results  │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
    ┌─────────┐        ┌──────────┐        ┌──────────────┐
    │ Spotify │        │   AWS    │        │   YouTube    │
    │  OAuth  │        │ Services │        │  Data API    │
    └─────────┘        └──────────┘        └──────────────┘
                             ↓
                    ┌────────┴────────┐
                    ↓                 ↓
              ┌──────────┐      ┌──────────┐
              │   SQS    │      │ DynamoDB │
              │  Queue   │      │  Tables  │
              │ Job msgs │      │ Jobs +   │
              │          │      │ Cache    │
              └──────────┘      └──────────┘
