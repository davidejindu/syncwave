export async function createSpotifyPlaylist(
    userId: string,
    name: string,
    description: string,
    accessToken: string
  ): Promise<{ id: string; url: string }> {
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
  
  export async function addTracksToPlaylist(
    playlistId: string,
    trackUris: string[],
    accessToken: string
  ): Promise<void> {
    // Spotify allows max 100 tracks per request
    const chunks = chunkArray(trackUris, 100);
  
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
  
  function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }