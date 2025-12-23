import { cookies } from "next/headers";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("spotify_access_token")?.value;

  if (!accessToken) {
    return <p>Not authenticated</p>;
  }

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return <p>Failed to load profile</p>;
  }

  const profile = await res.json();

  return (
    <main style={{ padding: "2rem" }}>
      <h1>SyncWave Dashboard</h1>

      {profile.images?.[0] && (
        <img
          src={profile.images[0].url}
          width={100}
          height={100}
          alt="Spotify profile"
        />
      )}

      <p>
        <strong>Name:</strong> {profile.display_name}
      </p>
      <p>
        <strong>Spotify ID:</strong> {profile.id}
      </p>
    </main>
  );
}
