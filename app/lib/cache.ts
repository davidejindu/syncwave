import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const CACHE_TABLE = "syncwave-song-cache";

interface CachedMatch {
  youtubeTitle: string;
  spotifyUri: string;
  spotifyName: string;
  spotifyArtists: string[];
  cachedAt: string;
}

export async function getCachedMatch(youtubeTitle: string): Promise<string | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: CACHE_TABLE,
        Key: { youtubeTitle: youtubeTitle.toLowerCase() },
      })
    );

    if (result.Item) {
      console.log(`✓ Cache hit: ${youtubeTitle}`);
      return result.Item.spotifyUri;
    }
    
    return null;
  } catch (error) {
    console.error("Cache get error:", error);
    return null; // Don't fail job if cache fails
  }
}

export async function setCachedMatch(
  youtubeTitle: string,
  spotifyUri: string,
  spotifyName: string,
  spotifyArtists: string[]
): Promise<void> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: CACHE_TABLE,
        Item: {
          youtubeTitle: youtubeTitle.toLowerCase(),
          spotifyUri,
          spotifyName,
          spotifyArtists,
          cachedAt: new Date().toISOString(),
        },
      })
    );
    console.log(`✓ Cached: ${youtubeTitle} → ${spotifyName}`);
  } catch (error) {
    console.error("Cache set error:", error);
    // Don't fail job if cache fails
  }
}