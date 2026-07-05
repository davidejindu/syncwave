export interface Job {
  jobId: string;
  type: "PLAYLIST_MIGRATION";
  status: "queued" | "processing" | "completed" | "failed";
  spotifyUserId: string;
  spotifyRefreshToken: string;
  displayName?: string;
  playlistUrls: string[];
  options: {
    visibility: "private" | "public";
    maxTracksPerPlaylist?: number;
  };
  progress: {
    step: string;
    percent: number;
  };
  createdAt: string;
  updatedAt: string;
  error?: string;
  result?: { 
    spotifyPlaylistId: string;
    spotifyPlaylistUrl: string;
    spotifyPlaylistName: string;
    matched: number;
    failed: number;
    failedSongs: string[];
  };
}

export interface YouTubeVideo {
  title: string;
  videoId: string;
  duration: number;
}

export interface YouTubePlaylist {
  title: string;
  videos: YouTubeVideo[];
}

export interface SpotifySearchResult {
  id: string;
  name: string;
  artists: string[];
  duration_ms: number;
  uri: string;
}

export interface MatchResult {
  spotifyTrack: SpotifySearchResult | null;
  confidence: number;
  reason?: string;
}

export interface NormalizedSong {
  title: string;
  artist: string;
  originalTitle: string;
}

export function getJob(jobId: string): Promise<Job | null>;
export function createJob(job: Job): Promise<void>;
export function updateJob(jobId: string, updates: Partial<Job>): Promise<void>;
export function getCachedMatch(youtubeTitle: string): Promise<string | null>;
export function setCachedMatch(
  youtubeTitle: string,
  spotifyUri: string,
  spotifyName: string,
  spotifyArtists: string[]
): Promise<void>;
export function scrapeYouTubePlaylist(playlistUrl: string): Promise<YouTubePlaylist>;
export function normalizeYouTubeTitle(title: string): NormalizedSong;
export function refreshSpotifyToken(refreshToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}>;
export function searchSpotifyTrack(query: string, accessToken: string): Promise<SpotifySearchResult[]>;
export function matchTrack(
  ytTitle: string,
  ytArtist: string,
  ytDuration: number,
  spotifyResults: SpotifySearchResult[]
): MatchResult;
export function createSpotifyPlaylist(
  userId: string,
  name: string,
  description: string,
  accessToken: string
): Promise<{ id: string; url: string }>;
export function addTracksToPlaylist(
  playlistId: string,
  trackUris: string[],
  accessToken: string
): Promise<void>;
export function processJob(jobMessage: {
  jobId: string;
  spotifyUserId: string;
  playlistUrls: string[];
}): Promise<void>;
export function handler(event: {
  Records: Array<{
    body: string;
  }>;
}): Promise<{
  statusCode: number;
  body: string;
}>;
