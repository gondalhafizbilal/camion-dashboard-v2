'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';
import ReturnRequestsSection from '@/components/return-refund/ReturnRequestsSection';
import { formatDateTime } from '@/lib/dateTime';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function normalizeResponseList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
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

export default function ReturnRefundPage() {
  const router = useRouter();
  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusForm, setStatusForm] = useState({
    status: 'approved',
    adminNote: '',
  });
  const [statusFieldErrors, setStatusFieldErrors] = useState({
    status: '',
    adminNote: '',
  });

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
        throw new Error(Array.isArray(backendError) ? backendError.join(', ') : backendError);
      }

      return payload;
    },
    [token]
  );

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('pageNumber', String(pageNumber));
      params.set('itemsPerPage', String(itemsPerPage));
      if (statusFilter) params.set('status', statusFilter);
      if (String(search || '').trim()) {
        params.set('filters', JSON.stringify({ query: String(search).trim() }));
      }

      const data = await apiFetch(`/api/return-requests/admin/all?${params.toString()}`, { method: 'GET' });
      setRequests(normalizeResponseList(data));
    } catch (err) {
      setError(err.message || 'Failed to load return requests.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, itemsPerPage, pageNumber, search, statusFilter, token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openStatusModal = useCallback((request) => {
    setSelectedRequest(request || null);
    setStatusForm({
      status: 'approved',
      adminNote: '',
    });
    setStatusFieldErrors({ status: '', adminNote: '' });
    setError('');
    setShowStatusModal(true);
  }, []);

  const closeStatusModal = useCallback(() => {
    if (statusSaving) return;
    setShowStatusModal(false);
    setSelectedRequest(null);
    setStatusFieldErrors({ status: '', adminNote: '' });
    setStatusForm({ status: 'approved', adminNote: '' });
  }, [statusSaving]);

  const selectedRequestUuid = selectedRequest?.uuid || '';

  const onSubmitStatus = useCallback(
    async (event) => {
      event.preventDefault();

      const nextFieldErrors = { status: '', adminNote: '' };
      if (!String(statusForm.status || '').trim()) nextFieldErrors.status = 'Status is required.';
      if (!String(statusForm.adminNote || '').trim()) nextFieldErrors.adminNote = 'Admin note is required.';

      if (Object.values(nextFieldErrors).some(Boolean)) {
        setStatusFieldErrors(nextFieldErrors);
        return;
      }

      if (!selectedRequestUuid) return;

      setStatusSaving(true);
      setError('');
      setStatusFieldErrors({ status: '', adminNote: '' });

      try {
        await apiFetch(`/api/return-requests/${encodeURIComponent(selectedRequestUuid)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: statusForm.status,
            adminNote: String(statusForm.adminNote).trim(),
          }),
        });
        setShowStatusModal(false);
        setSelectedRequest(null);
        await loadRequests();
      } catch (err) {
        const payload = err?.payload || {};
        const mappedErrors = extractFieldErrors(payload);
        setStatusFieldErrors({
          status: mappedErrors.status || '',
          adminNote: mappedErrors.adminNote || '',
        });
        setError(mappedErrors.error || err.message || 'Failed to update return request.');
      } finally {
        setStatusSaving(false);
      }
    },
    [apiFetch, loadRequests, selectedRequestUuid, statusForm.adminNote, statusForm.status]
  );

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  if (!isValid) {
    return <div className="screen-center">Loading return requests...</div>;
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
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h4 className="card-title mb-0">Return & Refund Management</h4>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <ReturnRequestsSection
                    loading={loading}
                    search={search}
                    setSearch={setSearch}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                    onRefresh={loadRequests}
                    requests={requests}
                    onOpenStatusModal={openStatusModal}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showStatusModal ? (
        <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Return Status</h5>
                <button type="button" className="btn-close" onClick={closeStatusModal} disabled={statusSaving} aria-label="Close" />
              </div>
              <div className="modal-body">
                  {selectedRequest ? (
                  <>
                    <div className="table-responsive mb-3">
                      <table className="table table-bordered mb-0">
                        <tbody>
                          <tr>
                            <th style={{ width: '220px' }}>Return UUID</th>
                            <td>{selectedRequest.uuid || '-'}</td>
                          </tr>
                          <tr>
                            <th>Order UUID</th>
                            <td>{selectedRequest?.order?.uuid || '-'}</td>
                          </tr>
                          {selectedRequest?.customer?.fullName ||
                          selectedRequest?.customer?.emailAddress ||
                          selectedRequest?.customer?.phoneNumber ? (
                            <tr>
                              <th>Customer</th>
                              <td>{selectedRequest?.customer?.fullName || '-'}</td>
                            </tr>
                          ) : null}
                          <tr>
                            <th>Reason</th>
                            <td>{normalizeReason(selectedRequest.reason)}</td>
                          </tr>
                          <tr>
                            <th>Reason Detail</th>
                            <td>{selectedRequest.reasonDetail || '-'}</td>
                          </tr>
                          <tr>
                            <th>Status</th>
                            <td>{normalizeStatus(selectedRequest.status)}</td>
                          </tr>
                          <tr>
                            <th>Refund Amount</th>
                            <td>{amountView(selectedRequest.refundAmount)}</td>
                          </tr>
                          <tr>
                            <th>Evidence</th>
                            <td>{Array.isArray(selectedRequest.evidence) ? selectedRequest.evidence.length : 0}</td>
                          </tr>
                          <tr>
                            <th>Created At</th>
                            <td>{formatDateTime(selectedRequest.createdAt)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <form onSubmit={onSubmitStatus}>
                      <div className="row">
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Status</label>
                          <select
                            className={`form-control ${statusFieldErrors.status ? 'is-invalid' : ''}`}
                            value={statusForm.status}
                            onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}
                            disabled={statusSaving}
                          >
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                          {statusFieldErrors.status ? <div className="invalid-feedback">{statusFieldErrors.status}</div> : null}
                        </div>
                        <div className="col-md-8 mb-3">
                          <label className="form-label">Admin Note</label>
                          <textarea
                            className={`form-control ${statusFieldErrors.adminNote ? 'is-invalid' : ''}`}
                            rows={4}
                            value={statusForm.adminNote}
                            onChange={(e) => setStatusForm((prev) => ({ ...prev, adminNote: e.target.value }))}
                            placeholder="Add approval or rejection note"
                            disabled={statusSaving}
                          />
                          {statusFieldErrors.adminNote ? <div className="invalid-feedback">{statusFieldErrors.adminNote}</div> : null}
                        </div>
                      </div>
                    </form>

                    {Array.isArray(selectedRequest?.evidence) && selectedRequest.evidence.length > 0 ? (
                      <>
                        <h6 className="mb-2">Evidence</h6>
                        <div className="row">
                          {selectedRequest.evidence.map((item) => {
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
                                        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px' }}
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
                          })}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeStatusModal} disabled={statusSaving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={onSubmitStatus} disabled={statusSaving || !selectedRequest?.uuid}>
                  {statusSaving ? 'Saving...' : 'Update Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
