import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getJob } from "@/app/lib/dynamodb";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }  // ← Changed to Promise
) {
  // 1. Authenticate user
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2. Get Spotify user ID
  const accessToken = cookieStore.get("spotify_access_token")?.value;
  
  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token - please refresh" },
      { status: 401 }
    );
  }

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

  // 3. Get job from DynamoDB
  const { jobId } = await params;  // ← Await params first!
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  // 4. Verify job belongs to user
  if (job.spotifyUserId !== spotifyUserId) {
    return NextResponse.json(
      { error: "Unauthorized - this job belongs to another user" },
      { status: 403 }
    );
  }

  // 5. Return job status
  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
    result: job.result,
  });
}