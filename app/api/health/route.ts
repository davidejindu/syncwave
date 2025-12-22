import { NextResponse } from "next/server";

export async function GET() {

    return NextResponse.json({
        service: "syncwave",
        status: "ok",
        message: "Syncwave backend is running",
        timestamp: new Date().toISOString(),
    });
    
}