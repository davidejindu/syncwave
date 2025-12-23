import { NextResponse } from "next/server";
import { pollQueue } from "@/app/lib/worker";

export async function GET() {
  try {
    await pollQueue();
    return NextResponse.json({ status: "Worker executed" });
  } catch (error) {
    console.error("Worker error:", error);
    return NextResponse.json(
      { error: "Worker failed" },
      { status: 500 }
    );
  }
}