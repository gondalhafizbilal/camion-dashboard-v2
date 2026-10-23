const INBOUND_STATUS_LABELS = {
  pending: 'Pending',
  awaiting_tracking: 'Awaiting Tracking',
  '10': 'Draft',
  '11': 'Forecasted',
  '12': 'Received',
  '13': 'Partially Stored',
  '14': 'Stored',
  '15': 'Warehouse Closed',
  '16': 'Deleted',
};

const OUTBOUND_STATUS_LABELS = {
  pending: 'Pending',
  '10': 'Draft',
  '11': 'Forecast In Progress',
  '12': 'Forecast Failed',
  '13': 'Forecast Completed',
  '14': 'Shipped',
  '15': 'Invalidated',
};

const RETURN_STATUS_LABELS = {
  pending: 'Pending',
  '10': 'Draft',
  '20': 'Approved',
  '30': 'Received',
  '40': 'Shelved',
  '60': 'Exception Pending',
};

function normalizeType(type) {
  return String(type || '').toLowerCase();
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase();
}

export function getWmsStatusLabel(type, status) {
  const t = normalizeType(type);
  const s = normalizeStatus(status);

  if (t === 'inbound') return INBOUND_STATUS_LABELS[s] || s || '-';
  if (t === 'outbound') return OUTBOUND_STATUS_LABELS[s] || s || '-';
  if (t === 'return') return RETURN_STATUS_LABELS[s] || s || '-';

  return s || '-';
}

