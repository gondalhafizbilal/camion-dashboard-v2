function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function formatDate(value, options = {}) {
  const date = parseDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    ...options,
  }).format(date);
}

export function toLocalDateTimeInputValue(value) {
  const date = parseDate(value);
  if (!date) return '';

  const pad = (part) => String(part).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
