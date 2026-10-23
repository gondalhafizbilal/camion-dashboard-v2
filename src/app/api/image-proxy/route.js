import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceUrl = String(searchParams.get('url') || '').trim();

    if (!sourceUrl) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: ['url query param is required'],
          error: 'Bad Request',
        },
        { status: 400 }
      );
    }

    const upstream = await fetch(sourceUrl, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json(
        {
          statusCode: upstream.status,
          message: [`failed to fetch image (${upstream.status})`],
          error: 'Bad Request',
        },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = await upstream.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: 'fail',
        errors: {
          error: 'Unable to proxy image.',
        },
      },
      { status: 503 }
    );
  }
}

