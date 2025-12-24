import { NextResponse } from "next/server";
import { pollQueue } from "@/app/lib/worker";

let isWorkerRunning = false;

export async function GET() {
  if (isWorkerRunning) {
    return NextResponse.json({
      message: "Worker is already running",
      status: "running",
    });
  }

  isWorkerRunning = true;
  runWorkerLoop();

  return NextResponse.json({
    message: "Worker started successfully",
    status: "started",
  });
}

async function runWorkerLoop() {
  console.log("Worker started - continuously polling SQS...");

  while (isWorkerRunning) {
    try {
      await pollQueue();
    } catch (error) {
      console.error("Worker error:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.log("Worker stopped");
}

export async function POST() {
  isWorkerRunning = false;
  return NextResponse.json({
    message: "Worker stopped",
    status: "stopped",
  });
}