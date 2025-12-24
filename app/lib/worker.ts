import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { getJob, type Job } from "./dynamodb";
import { updateJob } from "./dynamodb";
import { scrapeYouTubePlaylist } from "./youtube";
import { normalizeYouTubeTitle } from "./normalize";
import { searchSpotifyTrack, matchTrack } from "./spotifyMatcher";
import { createSpotifyPlaylist, addTracksToPlaylist } from "./spotifyPlaylist";
import { refreshSpotifyToken } from "./spotify";
import { cookies } from "next/headers";
import { getCachedMatch, setCachedMatch } from "./cache";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

export async function pollQueue() {
  console.log("Polling SQS queue...");

  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20, // Long polling
  });

  const response = await sqsClient.send(command);

  if (!response.Messages || response.Messages.length === 0) {
    console.log("No messages in queue");
    return;
  }

  const message = response.Messages[0];
  const body = JSON.parse(message.Body!);

  console.log("Processing job:", body.jobId);

  try {
    await processJob(body);

    // Delete message from queue
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );

    console.log("Job completed:", body.jobId);
} catch (error) {
    console.error("Job failed:", body.jobId, error);
    
    // Update job as failed
    await updateJob(body.jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      updatedAt: new Date().toISOString(),
    });
    
    //DELETE THE MESSAGE FROM QUEUE
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );
  }
}

async function processJob(jobMessage: any) {
  const { jobId, spotifyUserId, playlistUrls } = jobMessage;

  // Update status to processing
  await updateJob(jobId, {
    status: "processing",
    progress: { step: "scraping YouTube", percent: 10 },
    updatedAt: new Date().toISOString(),
  });

  // 1. Scrape YouTube playlist
  const youtubePlaylist = await scrapeYouTubePlaylist(playlistUrls[0]);
  console.log(`Found ${youtubePlaylist.videos.length} videos`);

  // 2. Get Spotify access token from job data
  const job = await getJob(jobId);
  
  if (!job || !job.spotifyRefreshToken) {
    throw new Error("Job not found or missing Spotify credentials");
  }

  const tokens = await refreshSpotifyToken(job.spotifyRefreshToken);
  const accessToken = tokens.access_token;

  // 3. Create Spotify playlist
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

  // 4. Match and add songs
  const matchedTracks: string[] = [];
  const failedSongs: string[] = [];
  
  // 🆕 Cache tracking
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

    // 🆕 CHECK CACHE FIRST
    const cachedUri = await getCachedMatch(video.title);
    
    if (cachedUri) {
      matchedTracks.push(cachedUri);
      cacheHits++;
      console.log(`✓ Cache hit: ${video.title}`);
      continue; // Skip Spotify API call!
    }

    // Normalize title
    const normalized = normalizeYouTubeTitle(video.title);
    
    // Search Spotify
    const query = normalized.artist
      ? `${normalized.title} ${normalized.artist}`
      : normalized.title;
    
    const searchResults = await searchSpotifyTrack(query, accessToken);
    spotifyApiCalls++; // 🆕 Count API call
    
    // Match
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
      
      // 🆕 CACHE SUCCESSFUL MATCH
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

    // Rate limit protection
    await sleep(100);
  }

  // 🆕 LOG CACHE STATS
  const totalAttempts = cacheHits + spotifyApiCalls;
  const reduction = totalAttempts > 0 
    ? Math.round((cacheHits / totalAttempts) * 100) 
    : 0;
    
  console.log(`\n📊 Cache Performance:`);
  console.log(`   Cache hits: ${cacheHits}`);
  console.log(`   Spotify API calls: ${spotifyApiCalls}`);
  console.log(`   API call reduction: ${reduction}%`);

  // 5. Add matched tracks to playlist
  if (matchedTracks.length > 0) {
    await addTracksToPlaylist(spotifyPlaylist.id, matchedTracks, accessToken);
  }

  // 6. Mark as completed
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
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}