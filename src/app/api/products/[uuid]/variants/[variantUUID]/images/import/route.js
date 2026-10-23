import { forwardRequest } from '@/lib/serverApiProxy';

function guessFilename(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split('/').filter(Boolean).pop() || 'image';
    return last.includes('.') ? last : `${last}.jpg`;
  } catch {
    return 'image.jpg';
  }
}

export async function POST(request, { params }) {
  const { uuid, variantUUID } = await params;
  const body = await request.json().catch(() => ({}));
  const url = String(body?.url || '').trim();

  if (!url) {
    return Response.json(
      {
        statusCode: 400,
        message: ['url is required'],
        error: 'Bad Request',
      },
      { status: 400 }
    );
  }

  // Fetch remote image then re-upload it as multipart/form-data to the backend.
  const remote = await fetch(url, { cache: 'no-store' });
  if (!remote.ok) {
    return Response.json(
      {
        statusCode: 400,
        message: [`failed to fetch image (${remote.status})`],
        error: 'Bad Request',
      },
      { status: 400 }
    );
  }

  const contentType = remote.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await remote.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: contentType });

  const formData = new FormData();
  formData.append('file', blob, guessFilename(url));

  return forwardRequest(request, `/v1/products/${uuid}/variants/${variantUUID}/images`, {
    method: 'POST',
    body: formData,
  });
}

