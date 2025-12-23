import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

export interface SQSJobMessage {
  jobId: string;
  type: "PLAYLIST_MIGRATION";
  spotifyUserId: string;
  playlistUrls: string[];
  options: {
    visibility: "private" | "public";
    maxTracksPerPlaylist?: number;
  };
}

export async function enqueueJob(message: SQSJobMessage): Promise<void> {
  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(message),
    })
  );
}