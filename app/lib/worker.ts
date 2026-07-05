import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { processJob, updateJob } from "../../lambda/index.mjs";

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

export async function pollQueue() {
  console.log("Polling SQS queue...");

  const command = new ReceiveMessageCommand({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20, // Long polling
  });

  const response = await sqsClient.send(command);

  if (!response.Messages || response.Messages.length === 0) {
    console.log("No messages in queue");
    return;
  }

  const message = response.Messages[0];
  const body = JSON.parse(message.Body!);

  console.log("Processing job:", body.jobId);

  try {
    await processJob(body);

    // Delete message from queue
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );

    console.log("Job completed:", body.jobId);
  } catch (error) {
    console.error("Job failed:", body.jobId, error);
    
    // Update job as failed
    await updateJob(body.jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
      updatedAt: new Date().toISOString(),
    });
    
    // DELETE THE MESSAGE FROM QUEUE
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle!,
      })
    );
  }
}