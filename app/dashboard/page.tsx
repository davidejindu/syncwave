"use client";

import { useEffect, useState } from "react";

interface Job {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: {
    step: string;
    percent: number;
  };
  createdAt: string;
  updatedAt: string;
  result?: {
    spotifyPlaylistId: string;
    spotifyPlaylistUrl: string;
    spotifyPlaylistName: string;
    matched: number;
    failed: number;
    failedSongs: string[];
  };
  error?: string;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        padding: "1.5rem",
        borderRadius: "8px",
        border: "1px solid #333",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          fontSize: "2.5rem",
          fontWeight: "bold",
          marginBottom: "0.5rem",
        }}
      >
        {value}
      </div>
      <div
        style={{
          color: "#888",
          fontSize: "0.9rem",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const statusColors = {
    queued: "#888",
    processing: "#FFA500",
    completed: "#1DB954",
    failed: "#FF4444",
  };

  const statusEmojis = {
    queued: "⏳",
    processing: "🔄",
    completed: "✅",
    failed: "❌",
  };

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: "8px",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "24px" }}>{statusEmojis[job.status]}</span>
          <span
            style={{
              fontWeight: "bold",
              fontSize: "1.1rem",
              color: statusColors[job.status],
            }}
          >
            {job.status.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            color: "#888",
            fontSize: "0.85rem",
            fontFamily: "monospace",
          }}
        >
          {job.jobId}
        </div>
      </div>

      {job.status === "processing" && (
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              height: "8px",
              backgroundColor: "#333",
              borderRadius: "4px",
              overflow: "hidden",
              marginBottom: "0.5rem",
            }}
          >
            <div
              style={{
                height: "100%",
                backgroundColor: "#1DB954",
                transition: "width 0.3s ease",
                width: `${job.progress.percent}%`,
              }}
            />
          </div>
          <div style={{ color: "#888", fontSize: "0.9rem" }}>
            {job.progress.step} - {job.progress.percent}%
          </div>
        </div>
      )}

      {job.status === "completed" && job.result && (
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "bold",
              marginBottom: "0.75rem",
            }}
          >
            {job.result.spotifyPlaylistName}
          </div>
          <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem" }}>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>
              ✅ {job.result.matched} matched
            </span>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>
              ❌ {job.result.failed} failed
            </span>
            <span style={{ color: "#888", fontSize: "0.9rem" }}>
              📊{" "}
              {Math.round(
                (job.result.matched /
                  (job.result.matched + job.result.failed)) *
                  100
              )}
              % accuracy
            </span>
          </div>
          <a
            href={job.result.spotifyPlaylistUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              backgroundColor: "#1DB954",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              borderRadius: "24px",
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: "0.9rem",
            }}
          >
            🎵 Open in Spotify
          </a>
        </div>
      )}

      {job.status === "failed" && job.error && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#2a1515",
            border: "1px solid #FF4444",
            borderRadius: "4px",
          }}
        >
          <div style={{ color: "#FF4444", fontSize: "0.9rem" }}>
            Error: {job.error}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          paddingTop: "1rem",
          borderTop: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div style={{ color: "#666", fontSize: "0.85rem" }}>
          Created: {new Date(job.createdAt).toLocaleString()}
        </div>
        <div style={{ color: "#666", fontSize: "0.85rem" }}>
          Updated: {new Date(job.updatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Auto-start worker
    fetch("/api/worker/auto-start", { credentials: "include" }).catch(() => {
      console.log("Worker already running or failed to start");
    });

    // Fetch profile and jobs
    fetch("/api/me", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          // 🆕 If 401, redirect to login instead of showing error
          if (res.status === 401) {
            window.location.href = "/api/auth/spotify/login";
            return; // Stop processing
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // Handle redirect case
        setProfile(data);
        return fetch("/api/jobs/list", { credentials: "include" });
      })
      .then((res) => {
        if (!res || !res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch((err) => {
        // Don't show error if we're redirecting
        if (err.message !== "Redirecting") {
          setError(err.message);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const processingJobs = jobs.filter(
      (job) => job.status === "queued" || job.status === "processing"
    );

    if (processingJobs.length === 0) return;

    const interval = setInterval(() => {
      processingJobs.forEach(async (job) => {
        const res = await fetch(`/api/jobs/${job.jobId}`, {
          credentials: "include",
        });
        const updatedJob = await res.json();

        setJobs((prev) =>
          prev.map((j) => (j.jobId === updatedJob.jobId ? updatedJob : j))
        );
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [jobs]);

  if (loading)
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#0a0a0a",
          minHeight: "100vh",
          color: "#fff",
        }}
      >
        Loading...
      </div>
    );

  if (error)
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#0a0a0a",
          minHeight: "100vh",
          color: "#fff",
        }}
      >
        Error: {error}
      </div>
    );

  if (!profile) {
    if (typeof window !== "undefined") {
      window.location.href = "/api/auth/spotify/login";
    }
    return (
      <div
        style={{
          padding: "2rem",
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#0a0a0a",
          minHeight: "100vh",
          color: "#fff",
        }}
      >
        Redirecting to Spotify login...
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const res = await fetch("/api/jobs/submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "PLAYLIST_MIGRATION",
          source: {
            platform: "youtube",
            playlistUrls: [playlistUrl],
          },
          target: {
            platform: "spotify",
          },
          options: {
            visibility: "private",
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit job");
      }

      const data = await res.json();
      setSubmitSuccess(`Job submitted! ID: ${data.jobId}`);
      setPlaylistUrl("");

      // Start worker if not already running (ignore if already running)
      fetch("/api/worker/start", { credentials: "include" }).catch(() => {});

      // Refresh jobs list
      const jobsRes = await fetch("/api/jobs/list", { credentials: "include" });
      const jobsData = await jobsRes.json();
      setJobs(jobsData.jobs || []);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        padding: "2rem",
        maxWidth: "1200px",
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "#0a0a0a",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          paddingBottom: "1rem",
          borderBottom: "2px solid #1DB954",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "2.5rem", color: "#1DB954" }}>
            SyncWave Dashboard
          </h1>
          <p
            style={{ margin: "0.5rem 0 0 0", color: "#888", fontSize: "1rem" }}
          >
            YouTube → Spotify Playlist Migration
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {profile.images?.[0] && (
            <img
              src={profile.images[0].url}
              width={50}
              height={50}
              alt="Spotify profile"
              style={{ borderRadius: "50%", border: "2px solid #1DB954" }}
            />
          )}
          <div>
            <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
              {profile.display_name}
            </div>
            <div style={{ color: "#888", fontSize: "0.9rem" }}>
              {profile.id}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Total Jobs" value={jobs.length} color="#1DB954" />
        <StatCard
          label="Completed"
          value={jobs.filter((j) => j.status === "completed").length}
          color="#1DB954"
        />
        <StatCard
          label="Processing"
          value={
            jobs.filter(
              (j) => j.status === "processing" || j.status === "queued"
            ).length
          }
          color="#FFA500"
        />
        <StatCard
          label="Failed"
          value={jobs.filter((j) => j.status === "failed").length}
          color="#FF4444"
        />
      </div>

      <div style={{ marginTop: "2rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#fff" }}>
          Migrate YouTube Playlist
        </h2>
        <form onSubmit={handleSubmit}>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              padding: "1.5rem",
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="playlistUrl"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#888",
                  fontSize: "0.9rem",
                }}
              >
                YouTube Playlist URL
              </label>
              <input
                id="playlistUrl"
                type="text"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=..."
                required
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: "#0a0a0a",
                  border: "1px solid #333",
                  borderRadius: "4px",
                  color: "#fff",
                  fontSize: "1rem",
                  outline: "none",
                }}
              />
            </div>

            {submitError && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#2a1515",
                  border: "1px solid #FF4444",
                  borderRadius: "4px",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ color: "#FF4444", fontSize: "0.9rem" }}>
                  ❌ {submitError}
                </div>
              </div>
            )}

            {submitSuccess && (
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#1a2a1a",
                  border: "1px solid #1DB954",
                  borderRadius: "4px",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ color: "#1DB954", fontSize: "0.9rem" }}>
                  ✅ {submitSuccess}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !playlistUrl}
              style={{
                backgroundColor: submitting ? "#555" : "#1DB954",
                color: "#fff",
                padding: "0.75rem 2rem",
                borderRadius: "24px",
                border: "none",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {submitting ? "Submitting..." : "🚀 Migrate Playlist"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#fff" }}>
          Recent Jobs
        </h2>
        {jobs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              backgroundColor: "#1a1a1a",
              borderRadius: "8px",
              color: "#888",
            }}
          >
            <p>No jobs yet. Submit your first playlist migration!</p>
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {jobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
