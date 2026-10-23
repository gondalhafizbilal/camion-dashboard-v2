function asTrimmedString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function cutToMax(value, maxLength) {
  if (typeof maxLength !== 'number' || maxLength <= 0) return value;
  return value.slice(0, maxLength);
}

export function normalizeLocalizedField(value, maxLength) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const enRaw = value.en ?? value.titleEn ?? value.nameEn ?? value.valueEn ?? '';
    const arRaw = value.ar ?? value.titleAr ?? value.nameAr ?? value.valueAr ?? '';
    const en = cutToMax(asTrimmedString(enRaw), maxLength);
    const ar = cutToMax(asTrimmedString(arRaw), maxLength);

    if (en || ar) {
      return {
        en: en || ar,
        ar: ar || en,
      };
    }

    return { en: '', ar: '' };
  }

  const text = cutToMax(asTrimmedString(value), maxLength);
  return { en: text, ar: text };
}

export function normalizeProductBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

  const normalized = { ...body };

  for (const key of ['title', 'brief', 'description', 'descriptionHtml']) {
    if (key in normalized) {
      normalized[key] = normalizeLocalizedField(normalized[key]);
    }
  }

  return normalized;
}

export function normalizeOptionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!('name' in body)) return body;

  return {
    ...body,
    name: normalizeLocalizedField(body.name, 64),
  };
}

export function normalizeOptionValueBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!('value' in body)) return body;

  return {
    ...body,
    value: normalizeLocalizedField(body.value, 64),
  };
}

export function normalizeVariantBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  if (!('title' in body)) return body;

  const normalized = {
    ...body,
    title: normalizeLocalizedField(body.title),
  };

  if (normalized.cost && typeof normalized.cost === 'object') {
    normalized.cost = {
      ...normalized.cost,
      currencyCode: asTrimmedString(normalized.cost.currencyCode).toLowerCase(),
    };
  }

  if (normalized.price && typeof normalized.price === 'object') {
    normalized.price = {
      ...normalized.price,
      currencyCode: asTrimmedString(normalized.price.currencyCode).toLowerCase(),
    };
  }

  if (normalized.weight && typeof normalized.weight === 'object') {
    normalized.weight = {
      ...normalized.weight,
      unit: asTrimmedString(normalized.weight.unit).toLowerCase(),
    };
  }

  if (normalized.dimensions && typeof normalized.dimensions === 'object') {
    normalized.dimensions = {
      ...normalized.dimensions,
      unit: asTrimmedString(normalized.dimensions.unit).toLowerCase(),
    };
  }

  return normalized;
}
