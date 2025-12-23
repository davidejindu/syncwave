export interface NormalizedSong {
    title: string;
    artist: string;
    originalTitle: string;
  }

export function normalizeYouTubeTitle(title: string): NormalizedSong {
    // Remove common patterns
    let cleaned = title
      .replace(/\(official video\)/gi, "")
      .replace(/\[official video\]/gi, "")
      .replace(/\(official audio\)/gi, "")
      .replace(/\[official audio\]/gi, "")
      .replace(/\(lyrics\)/gi, "")
      .replace(/\[lyrics\]/gi, "")
      .replace(/\(official music video\)/gi, "")
      .replace(/\(official 4k video\)/gi, "")
      .replace(/\[official music video\]/gi, "")
      .replace(/\(official lyric video\)/gi, "")
      .replace(/\[official lyric video\]/gi, "")
      .replace(/\(audio\)/gi, "")
      .replace(/\[audio\]/gi, "")
      .replace(/\(hd\)/gi, "")
      .replace(/\[hd\]/gi, "")
      .replace(/\(4k\)/gi, "")
      .replace(/\[4k\]/gi, "")
      .replace(/\(visualizer\)/gi, "")
      .replace(/\[visualizer\]/gi, "")
      .replace(/\(visualiser\)/gi, "")
      .replace(/\[visualiser\]/gi, "")
      .replace(/\(lyric video\)/gi, "")
      .replace(/\[lyric video\]/gi, "")
      .replace(/\(music video\)/gi, "")
      .replace(/\[music video\]/gi, "")
      .replace(/\(video\)/gi, "")
      .replace(/\[video\]/gi, "")
      .replace(/\(explicit\)/gi, "")
      .replace(/\[explicit\]/gi, "")
      .replace(/\(clean\)/gi, "")
      .replace(/\[clean\]/gi, "")
      .replace(/\(radio edit\)/gi, "")
      .replace(/\[radio edit\]/gi, "")
      .replace(/\(remix\)/gi, "")
      .replace(/\[remix\]/gi, "")
      .replace(/\(remaster\)/gi, "")
      .replace(/\[remaster\]/gi, "")
      .replace(/\(remastered\)/gi, "")
      .replace(/\[remastered\]/gi, "")
      .replace(/\(live\)/gi, "")
      .replace(/\[live\]/gi, "")
      .replace(/\(acoustic\)/gi, "")
      .replace(/\[acoustic\]/gi, "")
      .replace(/\(cover\)/gi, "")
      .replace(/\[cover\]/gi, "")
      .replace(/\(slowed\)/gi, "")
      .replace(/\[slowed\]/gi, "")
      .replace(/\(reverb\)/gi, "")
      .replace(/\[reverb\]/gi, "")
      .replace(/\(8d audio\)/gi, "")
      .replace(/\[8d audio\]/gi, "")
      .replace(/\(nightcore\)/gi, "")
      .replace(/\[nightcore\]/gi, "")
      .replace(/\(sped up\)/gi, "")
      .replace(/\[sped up\]/gi, "")
      .replace(/\(slowed \+ reverb\)/gi, "")
      .replace(/\[slowed \+ reverb\]/gi, "")
      .replace(/\(prod\. by.*?\)/gi, "")
      .replace(/\[prod\. by.*?\]/gi, "")
      .replace(/\(ft\..*?\)/gi, "")
      .replace(/\[ft\..*?\]/gi, "")
      .replace(/\(feat\..*?\)/gi, "")
      .replace(/\[feat\..*?\]/gi, "")
      .replace(/\(featuring.*?\)/gi, "")
      .replace(/\[featuring.*?\]/gi, "")
      .replace(/\s+/g, " ") 
      .trim();
  
    // Try to extract artist - title pattern
    // "Artist - Song Title" or "Artist: Song Title"
    const separators = [" - ", " – ", ": ", " | ", " — "];
    
    for (const sep of separators) {
      if (cleaned.includes(sep)) {
        const [artist, ...titleParts] = cleaned.split(sep);
        return {
          artist: artist.trim(),
          title: titleParts.join(sep).trim(),
          originalTitle: title,
        };
      }
    }
  
    // No separator found - assume whole thing is title
    return {
      title: cleaned,
      artist: "",
      originalTitle: title,
    };
  }
