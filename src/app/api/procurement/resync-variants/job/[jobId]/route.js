import { forwardRequest } from '@/lib/serverApiProxy';

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const jobId = String(resolvedParams?.jobId || '').trim();
  if (!jobId) {
    return new Response(
      JSON.stringify({
        message: 'jobId is required.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return forwardRequest(request, `/v1/procurement/resync-variants/job/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
}
