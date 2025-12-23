export interface YouTubeVideo {
    title: string;
    videoId: string;
    duration: number; // seconds
  }
  
  export interface YouTubePlaylist {
    title: string;
    videos: YouTubeVideo[];
  }
  
  export async function scrapeYouTubePlaylist(
    playlistUrl: string
  ): Promise<YouTubePlaylist> {
    const playlistId = extractPlaylistId(playlistUrl);
    
    if (!playlistId) {
      throw new Error("Invalid YouTube playlist URL");
    }
  
    const API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!API_KEY) {
      throw new Error("YOUTUBE_API_KEY not configured");
    }
  
    try {
      // Get playlist details
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
  
      // Get all videos in playlist
      const videos: YouTubeVideo[] = [];
      let nextPageToken: string | undefined;
  
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
  
        // Get video IDs to fetch durations
        const videoIds = data.items
          .map((item: any) => item.contentDetails.videoId)
          .join(",");
  
        // Fetch video details (including duration)
        const videosResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${API_KEY}`
        );
  
        const videosData = await videosResponse.json();
  
        // Parse videos
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
  
  function extractPlaylistId(url: string): string | null {
    const match = url.match(/[?&]list=([^&]+)/);
    return match ? match[1] : null;
  }
  
  function parseISO8601Duration(duration: string): number {
    // Parse ISO 8601 duration format (e.g., "PT4M33S" → 273 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) return 0;
    
    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");
    
    return hours * 3600 + minutes * 60 + seconds;
  }