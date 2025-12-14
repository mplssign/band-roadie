import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log error details for debugging
    console.error('Client error report:', {
      digest: body.digest,
      message: body.message,
      userAgent: body.userAgent,
      timestamp: body.timestamp,
      url: body.url
    });

    // In the future, you could send this to a monitoring service like:
    // - Sentry
    // - LogRocket  
    // - Datadog
    // - Custom logging service

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing error report:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}