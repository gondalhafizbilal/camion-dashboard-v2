function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeFieldErrors(payload) {
  const result = {};
  const source = payload?.errors;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return result;

  Object.entries(source).forEach(([key, value]) => {
    if (!key) return;
    if (Array.isArray(value)) {
      const message = value.map((item) => asText(item)).filter(Boolean).join(', ');
      if (message) result[key] = message;
      return;
    }
    const message = asText(value);
    if (message) result[key] = message;
  });

  return result;
}

export function toApiError(payload, response, fallbackMessage = 'Request failed.') {
  const fieldErrors = normalizeFieldErrors(payload);
  const payloadMessage = Array.isArray(payload?.message)
    ? payload.message.map((item) => asText(item)).filter(Boolean).join('; ')
    : asText(payload?.message);
  const firstFieldMessage = Object.values(fieldErrors)[0] || '';
  const message = firstFieldMessage || payloadMessage || asText(payload?.error) || fallbackMessage;
  const error = new Error(message);
  error.status = Number(response?.status || 0);
  error.fieldErrors = fieldErrors;
  error.payload = payload;
  return error;
}

