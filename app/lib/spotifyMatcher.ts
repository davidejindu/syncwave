import Fuse from "fuse.js";

export interface SpotifySearchResult {
  id: string;
  name: string;
  artists: string[];
  duration_ms: number;
  uri: string;
}

export interface MatchResult {
  spotifyTrack: SpotifySearchResult | null;
  confidence: number; // 0-100
  reason?: string;
}

export async function searchSpotifyTrack(
  query: string,
  accessToken: string
): Promise<SpotifySearchResult[]> {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Spotify search failed");
  }

  const data = await response.json();
  
  return data.tracks.items.map((track: any) => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map((a: any) => a.name),
    duration_ms: track.duration_ms,
    uri: track.uri,
  }));
}

export function matchTrack(
  ytTitle: string,
  ytArtist: string,
  ytDuration: number,
  spotifyResults: SpotifySearchResult[]
): MatchResult {
  if (spotifyResults.length === 0) {
    return {
      spotifyTrack: null,
      confidence: 0,
      reason: "No Spotify results found",
    };
  }

  // Score each result
  const scored = spotifyResults.map((track) => {
    let score = 0;

    // Title similarity (0-50 points)
    const titleSimilarity = stringSimilarity(
      ytTitle.toLowerCase(),
      track.name.toLowerCase()
    );
    score += titleSimilarity * 50;

    // Artist similarity (0-30 points)
    if (ytArtist) {
      const artistSimilarity = Math.max(
        ...track.artists.map((artist) =>
          stringSimilarity(ytArtist.toLowerCase(), artist.toLowerCase())
        )
      );
      score += artistSimilarity * 30;
    }

    // Duration similarity (0-20 points)
    const ytDurationSec = ytDuration;
    const spotifyDurationSec = track.duration_ms / 1000;
    const durationDiff = Math.abs(ytDurationSec - spotifyDurationSec);
    
    if (durationDiff <= 2) {
      score += 20;
    } else if (durationDiff <= 5) {
      score += 15;
    } else if (durationDiff <= 10) {
      score += 10;
    } else if (durationDiff <= 30) {
      score += 5;
    }

    return { track, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];

  // Confidence threshold
  if (best.score >= 70) {
    return {
      spotifyTrack: best.track,
      confidence: best.score,
    };
  } else if (best.score >= 35) {
    return {
      spotifyTrack: best.track,
      confidence: best.score,
      reason: "Low confidence match",
    };
  } else {
    return {
      spotifyTrack: null,
      confidence: best.score,
      reason: "No confident match found",
    };
  }
}

function stringSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}