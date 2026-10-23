import { forwardRequest } from '@/lib/serverApiProxy';

function buildBackendPath(request, params) {
  const segments = Array.isArray(params?.path) ? params.path : [];
  const joined = segments
    .map((segment) => String(segment).trim())
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const { search } = new URL(request.url);
  const suffix = joined || 'affiliates';
  return `/v1/referral/${suffix}${search || ''}`;
}

async function pass(request, params, method) {
  const resolvedParams = await params;
  return forwardRequest(request, buildBackendPath(request, resolvedParams), {
    method,
    body: ['GET', 'DELETE'].includes(method) ? undefined : await request.text(),
  });
}

export async function GET(request, context) {
  return pass(request, context.params, 'GET');
}

export async function POST(request, context) {
  return pass(request, context.params, 'POST');
}

export async function PUT(request, context) {
  return pass(request, context.params, 'PUT');
}

export async function PATCH(request, context) {
  return pass(request, context.params, 'PATCH');
}

export async function DELETE(request, context) {
  return pass(request, context.params, 'DELETE');
}
