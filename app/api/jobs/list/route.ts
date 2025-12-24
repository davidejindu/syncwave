import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = "syncwave-jobs";

export async function GET() {
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

  // 3. Get all jobs for this user
  // Note: This requires a GSI (Global Secondary Index) on spotifyUserId
  // For now, we'll do a scan (not ideal for production, but works for portfolio)
  
  try {
    const response = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "spotifyUserId-createdAt-index", // We'll create this GSI
        KeyConditionExpression: "spotifyUserId = :userId",
        ExpressionAttributeValues: {
          ":userId": spotifyUserId,
        },
        ScanIndexForward: false, // Sort by createdAt descending (newest first)
      })
    );

    const jobs = response.Items || [];

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    
    // Fallback: If GSI doesn't exist, return empty array for now
    return NextResponse.json({ jobs: [] });
  }
}