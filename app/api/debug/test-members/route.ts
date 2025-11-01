/* eslint-disable no-console */
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const testUrl = url.origin + '/api/bands/003be463-e63a-4ec5-b152-4f64c60afcbf/members';
    
    console.log('[test-members] Testing Members API at:', testUrl);
    
    // Forward the request with all headers
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Cookie': request.headers.get('Cookie') || '',
        'User-Agent': request.headers.get('User-Agent') || '',
      },
    });
    
    console.log('[test-members] Response status:', response.status);
    console.log('[test-members] Response headers:', Object.fromEntries(response.headers.entries()));
    
    let responseBody;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }
    
    console.log('[test-members] Response body:', responseBody);
    
    return NextResponse.json({
      testUrl,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[test-members] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}