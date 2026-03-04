import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// ============================================================
// DYNAMODB OPERATIONS
// ============================================================

async function getJob(jobId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: "syncwave-jobs",
      Key: { jobId },
    })
  );
  return result.Item || null;
}

async function updateJob(jobId, updates) {
  const updateExpression = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.entries(updates).forEach(([key, value]) => {
    updateExpression.push(`#${key} = :${key}`);
    expressionAttributeNames[`#${key}`] = key;
    expressionAttributeValues[`:${key}`] = value;
  });

  await docClient.send(
    new UpdateCommand({
      TableName: "syncwave-jobs",
      Key: { jobId },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    })
  );
}

// ============================================================
// CACHE OPERATIONS
// ============================================================

async function getCachedMatch(youtubeTitle) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: "syncwave-song-cache",
        Key: { youtubeTitle: youtubeTitle.toLowerCase() },
      })
    );

    if (result.Item) {
      console.log(`✓ Cache hit: ${youtubeTitle}`);
      return result.Item.spotifyUri;
    }
    
    return null;
  } catch (error) {
    console.error("Cache get error:", error);
    return null;
  }
}

async function setCachedMatch(youtubeTitle, spotifyUri, spotifyName, spotifyArtists) {
  try {
    await docClient.send(
      new PutCommand({
        TableName: "syncwave-song-cache",
        Item: {
          youtubeTitle: youtubeTitle.toLowerCase(),
          spotifyUri,
          spotifyName,
          spotifyArtists,
          cachedAt: new Date().toISOString(),
        },
      })
    );
    console.log(`✓ Cached: ${youtubeTitle} → ${spotifyName}`);
  } catch (error) {
    console.error("Cache set error:", error);
  }
}

// ============================================================
// YOUTUBE SCRAPING
// ============================================================

async function scrapeYouTubePlaylist(playlistUrl) {
  const playlistId = extractPlaylistId(playlistUrl);
  
  if (!playlistId) {
    throw new Error("Invalid YouTube playlist URL");
  }

  const API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!API_KEY) {
    throw new Error("YOUTUBE_API_KEY not configured");
  }

  try {
    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${API_KEY}`
    );

    if (!playlistResponse.ok) {
      throw new Error(`YouTube API error: ${playlistResponse.status}`);
    }

    const playlistData = await playlistResponse.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      throw new Error("Playlist not found or is private");
    }

    const playlistTitle = playlistData.items[0].snippet.title;
    const videos = [];
    let nextPageToken;

    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
      url.searchParams.set("part", "snippet,contentDetails");
      url.searchParams.set("playlistId", playlistId);
      url.searchParams.set("maxResults", "50");
      url.searchParams.set("key", API_KEY);
      
      if (nextPageToken) {
        url.searchParams.set("pageToken", nextPageToken);
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      const videoIds = data.items
        .map(item => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${API_KEY}`
      );

      const videosData = await videosResponse.json();

      for (const video of videosData.items) {
        videos.push({
          title: video.snippet.title,
          videoId: video.id,
          duration: parseISO8601Duration(video.contentDetails.duration),
        });
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return {
      title: playlistTitle,
      videos,
    };
  } catch (error) {
    console.error("YouTube API error:", error);
    throw new Error("Failed to fetch YouTube playlist");
  }
}

function extractPlaylistId(url) {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

function parseISO8601Duration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  
  return hours * 3600 + minutes * 60 + seconds;
}

// ============================================================
// NORMALIZATION
// ============================================================

function normalizeYouTubeTitle(title) {
  let cleaned = title
    .replace(/\(official video\)/gi, "")
    .replace(/\[official video\]/gi, "")
    .replace(/\(official audio\)/gi, "")
    .replace(/\[official audio\]/gi, "")
    .replace(/\(lyrics\)/gi, "")
    .replace(/\[lyrics\]/gi, "")
    .replace(/\(official music video\)/gi, "")
    .replace(/\(official 4k video\)/gi, "")
    .replace(/\[official music video\]/gi, "")
    .replace(/\(official lyric video\)/gi, "")
    .replace(/\[official lyric video\]/gi, "")
    .replace(/\(audio\)/gi, "")
    .replace(/\[audio\]/gi, "")
    .replace(/\(hd\)/gi, "")
    .replace(/\[hd\]/gi, "")
    .replace(/\(4k\)/gi, "")
    .replace(/\[4k\]/gi, "")
    .replace(/\(visualizer\)/gi, "")
    .replace(/\[visualizer\]/gi, "")
    .replace(/\(visualiser\)/gi, "")
    .replace(/\[visualiser\]/gi, "")
    .replace(/\(lyric video\)/gi, "")
    .replace(/\[lyric video\]/gi, "")
    .replace(/\(music video\)/gi, "")
    .replace(/\[music video\]/gi, "")
    .replace(/\(video\)/gi, "")
    .replace(/\[video\]/gi, "")
    .replace(/\(explicit\)/gi, "")
    .replace(/\[explicit\]/gi, "")
    .replace(/\(clean\)/gi, "")
    .replace(/\[clean\]/gi, "")
    .replace(/\(radio edit\)/gi, "")
    .replace(/\[radio edit\)/gi, "")
    .replace(/\(remix\)/gi, "")
    .replace(/\[remix\]/gi, "")
    .replace(/\(remaster\)/gi, "")
    .replace(/\[remaster\]/gi, "")
    .replace(/\(remastered\)/gi, "")
    .replace(/\[remastered\]/gi, "")
    .replace(/\(live\)/gi, "")
    .replace(/\[live\]/gi, "")
    .replace(/\(acoustic\)/gi, "")
    .replace(/\[acoustic\]/gi, "")
    .replace(/\(cover\)/gi, "")
    .replace(/\[cover\]/gi, "")
    .replace(/\(slowed\)/gi, "")
    .replace(/\[slowed\]/gi, "")
    .replace(/\(reverb\)/gi, "")
    .replace(/\[reverb\]/gi, "")
    .replace(/\(8d audio\)/gi, "")
    .replace(/\[8d audio\]/gi, "")
    .replace(/\(nightcore\)/gi, "")
    .replace(/\[nightcore\]/gi, "")
    .replace(/\(sped up\)/gi, "")
    .replace(/\[sped up\]/gi, "")
    .replace(/\(slowed \+ reverb\)/gi, "")
    .replace(/\[slowed \+ reverb\]/gi, "")
    .replace(/\(prod\. by.*?\)/gi, "")
    .replace(/\[prod\. by.*?\]/gi, "")
    .replace(/\(ft\..*?\)/gi, "")
    .replace(/\[ft\..*?\]/gi, "")
    .replace(/\(feat\..*?\)/gi, "")
    .replace(/\[feat\..*?\]/gi, "")
    .replace(/\(featuring.*?\)/gi, "")
    .replace(/\[featuring.*?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const separators = [" - ", " – ", ": ", " | ", " — "];
  
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const [artist, ...titleParts] = cleaned.split(sep);
      return {
        artist: artist.trim(),
        title: titleParts.join(sep).trim(),
        originalTitle: title,
      };
    }
  }

  return {
    title: cleaned,
    artist: "",
    originalTitle: title,
  };
}

// ============================================================
// SPOTIFY OPERATIONS
// ============================================================

async function refreshSpotifyToken(refreshToken) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error("Failed to refresh Spotify token");
  }

  return data;
}

async function searchSpotifyTrack(query, accessToken) {
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
  
  return data.tracks.items.map(track => ({
    id: track.id,
    name: track.name,
    artists: track.artists.map(a => a.name),
    duration_ms: track.duration_ms,
    uri: track.uri,
  }));
}

function matchTrack(ytTitle, ytArtist, ytDuration, spotifyResults) {
  if (spotifyResults.length === 0) {
    return {
      spotifyTrack: null,
      confidence: 0,
      reason: "No Spotify results found",
    };
  }

  const scored = spotifyResults.map(track => {
    let score = 0;

    const titleSimilarity = stringSimilarity(
      ytTitle.toLowerCase(),
      track.name.toLowerCase()
    );
    score += titleSimilarity * 50;

    if (ytArtist) {
      const artistSimilarity = Math.max(
        ...track.artists.map(artist =>
          stringSimilarity(ytArtist.toLowerCase(), artist.toLowerCase())
        )
      );
      score += artistSimilarity * 30;
    }

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

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

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

function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];

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

async function createSpotifyPlaylist(userId, name, description, accessToken) {
  const response = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        public: false,
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create Spotify playlist");
  }

  const data = await response.json();

  return {
    id: data.id,
    url: data.external_urls.spotify,
  };
}

async function addTracksToPlaylist(playlistId, trackUris, accessToken) {
  const chunks = [];
  for (let i = 0; i < trackUris.length; i += 100) {
    chunks.push(trackUris.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: chunk,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to add tracks to playlist");
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// MAIN PROCESSING LOGIC
// ============================================================

async function processJob(jobMessage) {
  const { jobId, spotifyUserId, playlistUrls } = jobMessage;

  await updateJob(jobId, {
    status: "processing",
    progress: { step: "scraping YouTube", percent: 10 },
    updatedAt: new Date().toISOString(),
  });

  const youtubePlaylist = await scrapeYouTubePlaylist(playlistUrls[0]);
  console.log(`Found ${youtubePlaylist.videos.length} videos`);

  const job = await getJob(jobId);
  
  if (!job || !job.spotifyRefreshToken) {
    throw new Error("Job not found or missing Spotify credentials");
  }

  const tokens = await refreshSpotifyToken(job.spotifyRefreshToken);
  const accessToken = tokens.access_token;

  const timestamp = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  
  const playlistName = `${youtubePlaylist.title} (from YouTube - ${timestamp})`;
  
  const spotifyPlaylist = await createSpotifyPlaylist(
    spotifyUserId,
    playlistName,
    `Migrated from YouTube playlist: ${youtubePlaylist.title}`,
    accessToken
  );

  console.log("Created Spotify playlist:", spotifyPlaylist.id);

  const matchedTracks = [];
  const failedSongs = [];
  let cacheHits = 0;
  let spotifyApiCalls = 0;

  for (let i = 0; i < youtubePlaylist.videos.length; i++) {
    const video = youtubePlaylist.videos[i];
    const percent = 10 + Math.floor((i / youtubePlaylist.videos.length) * 80);

    await updateJob(jobId, {
      status: "processing",
      progress: {
        step: `matching songs (${i + 1}/${youtubePlaylist.videos.length})`,
        percent,
      },
      updatedAt: new Date().toISOString(),
    });

    const cachedUri = await getCachedMatch(video.title);
    
    if (cachedUri) {
      matchedTracks.push(cachedUri);
      cacheHits++;
      console.log(`✓ Cache hit: ${video.title}`);
      continue;
    }

    const normalized = normalizeYouTubeTitle(video.title);
    
    const query = normalized.artist
      ? `${normalized.title} ${normalized.artist}`
      : normalized.title;
    
    const searchResults = await searchSpotifyTrack(query, accessToken);
    spotifyApiCalls++;
    
    const match = matchTrack(
      normalized.title,
      normalized.artist,
      video.duration,
      searchResults
    );

    console.log(`Match result:`, {
      hasTrack: !!match.spotifyTrack,
      confidence: match.confidence,
      reason: match.reason
    });

    if (match.spotifyTrack && match.confidence >= 35) {
      matchedTracks.push(match.spotifyTrack.uri);
      
      await setCachedMatch(
        video.title,
        match.spotifyTrack.uri,
        match.spotifyTrack.name,
        match.spotifyTrack.artists
      );
      
      console.log(`✓ Matched: ${video.title} → ${match.spotifyTrack.name}`);
    } else {
      failedSongs.push(video.title);
      console.log(`✗ Failed: ${video.title} (confidence: ${match.confidence})`);
    }

    await sleep(100);
  }

  const totalAttempts = cacheHits + spotifyApiCalls;
  const reduction = totalAttempts > 0 
    ? Math.round((cacheHits / totalAttempts) * 100) 
    : 0;
    
  console.log(`\n📊 Cache Performance:`);
  console.log(`   Cache hits: ${cacheHits}`);
  console.log(`   Spotify API calls: ${spotifyApiCalls}`);
  console.log(`   API call reduction: ${reduction}%`);

  if (matchedTracks.length > 0) {
    await addTracksToPlaylist(spotifyPlaylist.id, matchedTracks, accessToken);
  }

  await updateJob(jobId, {
    status: "completed",
    progress: { step: "done", percent: 100 },
    result: {
      spotifyPlaylistId: spotifyPlaylist.id,
      spotifyPlaylistUrl: spotifyPlaylist.url,
      spotifyPlaylistName: playlistName,
      matched: matchedTracks.length,
      failed: failedSongs.length,
      failedSongs,
    },
    updatedAt: new Date().toISOString(),
  });

  console.log(`Complete: ${matchedTracks.length}/${youtubePlaylist.videos.length} matched`);
}

// ============================================================
// LAMBDA HANDLER (Entry Point)
// ============================================================

export const handler = async (event) => {
  console.log("🚀 Lambda triggered");
  console.log("Event:", JSON.stringify(event, null, 2));

  // SQS sends messages in event.Records array
  for (const record of event.Records) {
    const jobMessage = JSON.parse(record.body);
    console.log("📋 Processing job:", jobMessage.jobId);

    try {
      await processJob(jobMessage);
      console.log("✅ Job completed:", jobMessage.jobId);
    } catch (error) {
      console.error("❌ Job failed:", jobMessage.jobId, error);
      
      await updateJob(jobMessage.jobId, {
        status: "failed",
        error: error.message || "Unknown error",
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Processing complete" })
  };
};