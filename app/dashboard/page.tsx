"use client";

import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", {
      credentials: "include", // ✅ Add this
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!profile) return <p>Not authenticated</p>;

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
