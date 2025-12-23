import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { refreshSpotifyToken } from "@/app/lib/spotify";

export async function GET() {
  const cookieStore = await cookies();

  let accessToken = cookieStore.get("spotify_access_token")?.value;
  const refreshToken = cookieStore.get("spotify_refresh_token")?.value;

  console.log("Access token:", accessToken ? "exists" : "missing");
  console.log("Refresh token:", refreshToken ? "exists" : "missing");

  if (!refreshToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // If no access token, try to refresh
  if (!accessToken) {
    console.log("No access token, refreshing...");
    const newTokens = await refreshSpotifyToken(refreshToken);

    if (!newTokens.access_token) {
      return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
    }

    accessToken = newTokens.access_token;

    // Fetch profile with new token
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Spotify API failed" }, { status: 500 });
    }

    const profile = await res.json();
    const response = NextResponse.json(profile);

    // Set the new access token cookie
    response.cookies.set("spotify_access_token", newTokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: newTokens.expires_in || 3600,
    });

    return response;
  }

  // Access token exists, try using it
  let res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Token expired, refresh it
  if (res.status === 401) {
    console.log("Token expired, refreshing...");
    const newTokens = await refreshSpotifyToken(refreshToken);

    if (!newTokens.access_token) {
      return NextResponse.json({ error: "Failed to refresh" }, { status: 401 });
    }

    // Retry with new token
    res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${newTokens.access_token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Spotify API failed" }, { status: 500 });
    }

    const profile = await res.json();
    const response = NextResponse.json(profile);

    // Set the new access token cookie
    response.cookies.set("spotify_access_token", newTokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: newTokens.expires_in || 3600,
    });

    return response;
  }

  // Token still valid
  const profile = await res.json();
  return NextResponse.json(profile);
}