import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "syncwave-jobs";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface Job {
  jobId: string;
  type: "PLAYLIST_MIGRATION";
  status: JobStatus;
  spotifyUserId: string;
  displayName?: string;
  playlistUrls: string[];
  options: {
    visibility: "private" | "public";
    maxTracksPerPlaylist?: number;
  };
  progress: {
    step: string;
    percent: number;
  };
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export async function createJob(job: Job): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: job,
    })
  );
}

export async function getJob(jobId: string): Promise<Job | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { jobId },
    })
  );

  return result.Item as Job | null;
}