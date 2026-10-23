'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';
import { formatDateTime } from '@/lib/dateTime';

const ELIGIBLE_REASONS = new Set(['wrong_variation', 'damaged_broken', 'wrong_product']);

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function amountView(money) {
  if (!money) return '-';
  return `${money.currencyCode || ''} ${money.amount ?? 0}`.trim();
}

function normalizeReason(reason) {
  const key = String(reason || '').toLowerCase();
  if (key === 'wrong_variation') return 'Wrong Variation';
  if (key === 'damaged_broken') return 'Damaged / Broken';
  if (key === 'wrong_product') return 'Wrong Product';
  return key || '-';
}

function normalizeStatus(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'pending') return 'Pending';
  if (key === 'approved') return 'Approved';
  if (key === 'rejected') return 'Rejected';
  if (key === 'refunded') return 'Refunded';
  return key || '-';
}

function extractFieldErrors(payload) {
  const backendErrors = payload?.errors || {};
  return {
    status: Array.isArray(backendErrors?.status) ? backendErrors.status.join(', ') : backendErrors?.status || '',
    adminNote: Array.isArray(backendErrors?.adminNote)
      ? backendErrors.adminNote.join(', ')
      : backendErrors?.adminNote || '',
    error:
      Array.isArray(backendErrors?.error) ? backendErrors.error.join(', ') : backendErrors?.error || payload?.message || '',
  };
}

function isImageMime(mimeType = '') {
  return String(mimeType || '').toLowerCase().startsWith('image/');
}

function isVideoMime(mimeType = '') {
  return String(mimeType || '').toLowerCase().startsWith('video/');
}

function normalizeReturnRequest(payload) {
  if (!payload) return null;
  if (payload?.uuid) return payload;
  if (payload?.data?.uuid) return payload.data;
  return payload?.data || null;
}

export default function ReturnRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = String(params?.uuid || '').trim();

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [request, setRequest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ status: '', adminNote: '' });
  const [formData, setFormData] = useState({ status: 'approved', adminNote: '' });

  useEffect(() => {
    if (!isValid) {
      clearAuth();
      router.replace('/login');
      return;
    }

    const body = document.body;
    body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');

    const onResize = () => {
      body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isValid, router]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

      if (options.body !== undefined && !headers.has('Content-Type') && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mergedMessage = Array.isArray(payload?.message) ? payload.message.join('; ') : payload?.message;
        const backendError = payload?.errors?.error || mergedMessage || payload?.error || 'Request failed.';
        throw { payload, message: Array.isArray(backendError) ? backendError.join(', ') : backendError, status: response.status };
      }

      return payload;
    },
    [token]
  );

  const loadRequest = useCallback(async () => {
    if (!token || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/return-requests/${encodeURIComponent(uuid)}`, { method: 'GET' });
      const normalized = normalizeReturnRequest(data);
      setRequest(normalized);
      setFormData((prev) => ({
        status: normalized?.status && normalized.status !== 'pending' ? String(normalized.status).toLowerCase() : prev.status,
        adminNote: normalized?.adminNote || '',
      }));
    } catch (err) {
      setError(err.message || 'Failed to load return request.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const onSubmitDecision = async (event) => {
    event.preventDefault();
    const nextFieldErrors = { status: '', adminNote: '' };

    if (!String(formData.status || '').trim()) {
      nextFieldErrors.status = 'Decision is required.';
    }
    if (!String(formData.adminNote || '').trim()) {
      nextFieldErrors.adminNote = 'Admin note is required.';
    }

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    setFieldErrors({ status: '', adminNote: '' });

    try {
      await apiFetch(`/api/return-requests/${encodeURIComponent(uuid)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: formData.status,
          adminNote: String(formData.adminNote).trim(),
        }),
      });
      setMessage('Return request updated successfully.');
      await loadRequest();
    } catch (err) {
      const payload = err?.payload || {};
      const mappedErrors = extractFieldErrors(payload);
      setFieldErrors({
        status: mappedErrors.status || '',
        adminNote: mappedErrors.adminNote || '',
      });
      setError(mappedErrors.error || err.message || 'Failed to update return request.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = String(request?.status || '').toLowerCase();
  const canReview = currentStatus === 'pending';
  const reasonKey = String(request?.reason || '').toLowerCase();
  const eligible = ELIGIBLE_REASONS.has(reasonKey);
  const evidence = Array.isArray(request?.evidence) ? request.evidence : [];

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  if (!isValid) {
    return <div className="screen-center">Loading return request...</div>;
  }

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center flex-wrap" style={{ gap: '8px' }}>
                  <h4 className="card-title mb-0">Return Request Status Update</h4>
                  <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => loadRequest()} disabled={loading || submitting}>
                      Refresh
                    </button>
                    {request?.order?.uuid ? (
                      <Link href={`/orders/${request.order.uuid}`} className="btn btn-outline-info btn-sm">
                        View Order
                      </Link>
                    ) : null}
                    <Link href="/return-refund" className="btn btn-outline-primary btn-sm">
                      Back to Requests
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  {loading ? <p className="mb-0">Loading return request...</p> : null}

                  {!loading && request ? (
                    <>
                      <div className="row">
                        <div className="col-lg-8 mb-4">
                          <h5 className="h5-heading">Request Details</h5>
                          <div className="table-responsive mb-4">
                            <table className="table table-bordered mb-0">
                              <tbody>
                                <tr>
                                  <th style={{ width: '260px' }}>UUID</th>
                                  <td>{request.uuid || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Status</th>
                                  <td>{normalizeStatus(request.status)}</td>
                                </tr>
                                <tr>
                                  <th>Reason</th>
                                  <td>{normalizeReason(request.reason)}</td>
                                </tr>
                                <tr>
                                  <th>Reason Detail</th>
                                  <td>{request.reasonDetail || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Refund Amount</th>
                                  <td>{amountView(request.refundAmount)}</td>
                                </tr>
                                <tr>
                                  <th>Admin Note</th>
                                  <td>{request.adminNote || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Created At</th>
                                  <td>{formatDateTime(request.createdAt)}</td>
                                </tr>
                                <tr>
                                  <th>Updated At</th>
                                  <td>{formatDateTime(request.updatedAt)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <h5 className="h5-heading">Customer & Order</h5>
                          <div className="table-responsive mb-4">
                            <table className="table table-bordered mb-0">
                              <tbody>
                                <tr>
                                  <th style={{ width: '260px' }}>Customer</th>
                                  <td>{request?.customer?.fullName || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Email</th>
                                  <td>{request?.customer?.emailAddress || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Phone</th>
                                  <td>{request?.customer?.phoneNumber || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Order UUID</th>
                                  <td>{request?.order?.uuid || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Order Status</th>
                                  <td>{request?.order?.status ? String(request.order.status).toLowerCase() : '-'}</td>
                                </tr>
                                <tr>
                                  <th>Order Total</th>
                                  <td>{amountView(request?.order?.total)}</td>
                                </tr>
                                <tr>
                                  <th>Order Item</th>
                                  <td>{request?.orderItem?.uuid || '-'}</td>
                                </tr>
                                <tr>
                                  <th>Item Quantity</th>
                                  <td>{request?.orderItem?.quantity ?? '-'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="col-lg-4 mb-4">
                          <h5 className="h5-heading">Eligibility</h5>
                          <div className="table-responsive mb-4">
                            <table className="table table-bordered mb-0">
                              <tbody>
                                <tr>
                                  <th style={{ width: '180px' }}>Eligible Reason</th>
                                  <td>{eligible ? 'Yes' : 'No'}</td>
                                </tr>
                                <tr>
                                  <th>Evidence Required</th>
                                  <td>Yes</td>
                                </tr>
                                <tr>
                                  <th>Evidence Uploaded</th>
                                  <td>{evidence.length > 0 ? 'Yes' : 'No'}</td>
                                </tr>
                                <tr>
                                  <th>Evidence Count</th>
                                  <td>{evidence.length}</td>
                                </tr>
                                <tr>
                                  <th>Review Allowed</th>
                                  <td>{canReview ? 'Yes' : 'No'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          <h5 className="h5-heading">Status Update</h5>
                          <form onSubmit={onSubmitDecision}>
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <select
                                className={`form-control ${fieldErrors.status ? 'is-invalid' : ''}`}
                                value={formData.status}
                                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                                disabled={submitting || !canReview}
                              >
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                              </select>
                              {fieldErrors.status ? <div className="invalid-feedback">{fieldErrors.status}</div> : null}
                            </div>

                            <div className="mb-3">
                              <label className="form-label">Admin Note</label>
                              <textarea
                                rows={5}
                                className={`form-control ${fieldErrors.adminNote ? 'is-invalid' : ''}`}
                                value={formData.adminNote}
                                onChange={(e) => setFormData((prev) => ({ ...prev, adminNote: e.target.value }))}
                                placeholder="Add approval or rejection note"
                                disabled={submitting || !canReview}
                              />
                              {fieldErrors.adminNote ? <div className="invalid-feedback">{fieldErrors.adminNote}</div> : null}
                            </div>

                            {!canReview ? (
                              <div className="alert alert-warning">This request is no longer pending, so it cannot be reviewed again.</div>
                            ) : null}

                            <button className="btn btn-primary btn-sm" type="submit" disabled={submitting || !canReview}>
                              {submitting ? 'Saving...' : 'Update Status'}
                            </button>
                          </form>
                        </div>
                      </div>

                      <h5 className="h5-heading">Evidence</h5>
                      <div className="row">
                        {evidence.length > 0 ? (
                          evidence.map((item) => {
                            const src = item?.url ? getTransformedImageUrl(item.url) || item.url : '';
                            return (
                              <div className="col-md-4 mb-3" key={item.uuid || item.url}>
                                <div className="card h-100">
                                  <div className="card-body">
                                    <div className="mb-2">
                                      <strong>{item?.mimeType || 'Evidence'}</strong>
                                    </div>
                                    <div className="mb-2 text-muted">{formatDateTime(item?.createdAt)}</div>
                                    {isImageMime(item?.mimeType) && src ? (
                                      <img
                                        src={src}
                                        alt={item.uuid || 'Evidence'}
                                        style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '6px' }}
                                      />
                                    ) : isVideoMime(item?.mimeType) && src ? (
                                      <video controls style={{ width: '100%', borderRadius: '6px' }}>
                                        <source src={src} type={item?.mimeType || undefined} />
                                      </video>
                                    ) : src ? (
                                      <a href={src} target="_blank" rel="noreferrer">
                                        Open evidence
                                      </a>
                                    ) : (
                                      <span className="text-muted">No preview available.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-12">
                            <div className="alert alert-info mb-0">No evidence uploaded for this return request.</div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
