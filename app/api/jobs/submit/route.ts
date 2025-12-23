import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateJobId } from "@/app/lib/jobId";
import { createJob, type Job } from "@/app/lib/dynamodb";
import { enqueueJob } from "@/app/lib/sqs";

interface SubmitJobRequest {
  type: "PLAYLIST_MIGRATION";
  source: {
    platform: "youtube";
    playlistUrls: string[];
  };
  target: {
    platform: "spotify";
  };
  options?: {
    visibility?: "private" | "public";
    maxTracksPerPlaylist?: number;
  };
}

export async function POST(req: Request) {
  // 1. Authenticate user via cookies
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;
  const accessToken = cookieStore.get("spotify_access_token")?.value;

  if (!refreshToken || !accessToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2. Get user identity from Spotify
  const spotifyRes = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!spotifyRes.ok) {
    return NextResponse.json(
      { error: "Failed to verify Spotify identity" },
      { status: 401 }
    );
  }

  const spotifyUser = await spotifyRes.json();
  const spotifyUserId = spotifyUser.id;
  const displayName = spotifyUser.display_name;

  // 3. Parse and validate request
  let body: SubmitJobRequest;
  
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  // Validate type
  if (body.type !== "PLAYLIST_MIGRATION") {
    return NextResponse.json(
      { error: "Invalid job type" },
      { status: 400 }
    );
  }

  // Validate source
  if (body.source?.platform !== "youtube") {
    return NextResponse.json(
      { error: "Only YouTube source supported" },
      { status: 400 }
    );
  }

  // Validate playlist URLs
  const playlistUrls = body.source?.playlistUrls || [];
  
  if (!Array.isArray(playlistUrls) || playlistUrls.length === 0) {
    return NextResponse.json(
      { error: "playlistUrls must be non-empty array" },
      { status: 400 }
    );
  }

  if (playlistUrls.length > 20) {
    return NextResponse.json(
      { error: "Maximum 20 playlists per job" },
      { status: 400 }
    );
  }

  // Validate each URL
  for (const url of playlistUrls) {
    if (typeof url !== "string" || url.length > 2048) {
      return NextResponse.json(
        { error: "Invalid playlist URL" },
        { status: 400 }
      );
    }
  }

  // 4. Generate job ID
  const jobId = generateJobId();

  // 5. Create job record in DynamoDB
  const job: Job = {
    jobId,
    type: "PLAYLIST_MIGRATION",
    status: "queued",
    spotifyUserId,
    spotifyRefreshToken: refreshToken,
    displayName,
    playlistUrls,
    options: {
      visibility: body.options?.visibility || "private",
      maxTracksPerPlaylist: body.options?.maxTracksPerPlaylist || 500,
    },
    progress: {
      step: "queued",
      percent: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await createJob(job);
  } catch (error) {
    console.error("Failed to create job in DynamoDB:", error);
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 }
    );
  }

  // 6. Enqueue job to SQS
  try {
    await enqueueJob({
      jobId,
      type: "PLAYLIST_MIGRATION",
      spotifyUserId,
      playlistUrls,
      options: job.options,
    });
  } catch (error) {
    console.error("Failed to enqueue job to SQS:", error);
    return NextResponse.json(
      { error: "Failed to queue job" },
      { status: 500 }
    );
  }

  // 7. Return 202 Accepted
  return NextResponse.json(
    {
      jobId,
      status: "queued",
    },
    { status: 202 }
  );
}