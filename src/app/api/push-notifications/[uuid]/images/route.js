import { forwardRequest } from '@/lib/serverApiProxy';

export async function POST(request, { params }) {
  const { uuid } = await params;
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return Response.json(
      {
        errors: {
          file: 'Image file is required.',
        },
      },
      { status: 400 }
    );
  }

  const body = new FormData();
  body.append('file', file);

  return forwardRequest(request, `/v1/push-notifications/${encodeURIComponent(uuid)}/images`, {
    method: 'POST',
    body,
  });
}
