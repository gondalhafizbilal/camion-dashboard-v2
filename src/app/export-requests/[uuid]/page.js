'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { formatDateTime } from '@/lib/dateTime';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function ExportRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = String(params?.uuid || '').trim();
  const [menuToggled, setMenuToggled] = useState(false);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState('pending');
  const [savingStatus, setSavingStatus] = useState(false);

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

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

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

      if (options.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mergedMessage = Array.isArray(payload?.message) ? payload.message.join('; ') : payload?.message;
        const backendError = payload?.errors?.error || mergedMessage || payload?.error || 'Request failed.';
        throw new Error(backendError);
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
      const data = await apiFetch(`/api/export-requests/${encodeURIComponent(uuid)}`, { method: 'GET' });
      setRequest(data || null);
      setNextStatus(data?.status || 'pending');
    } catch (err) {
      setError(err.message || 'Failed to load export request.');
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  const onUpdateStatus = async () => {
    if (!uuid || !nextStatus) return;
    setSavingStatus(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/export-requests/${encodeURIComponent(uuid)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage('Export request status updated.');
      setShowStatusModal(false);
      await loadRequest();
    } catch (err) {
      setError(err.message || 'Failed to update export request status.');
    } finally {
      setSavingStatus(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading export request...</div>;
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
                  <h4 className="card-title mb-0">Export Request Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href="/export-requests" className="btn btn-outline-primary btn-sm">
                      Back
                    </Link>
                    <Link href={`/export-requests/${uuid}/edit`} className="btn btn-primary btn-sm">
                      Edit
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  {loading ? (
                    <p className="mb-0">Loading export request...</p>
                  ) : request ? (
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <strong>Name:</strong>
                        <div>{request.name || '-'}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Format:</strong>
                        <div>{request.format || '-'}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Pages Count:</strong>
                        <div>{request.pagesCount ?? '-'}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Status:</strong>
                        <div>{request.status || '-'}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Category:</strong>
                        <div>{request?.category?.nameEn || request?.category?.slug || '-'}</div>
                        <small className="text-muted">{request?.category?.uuid || ''}</small>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Download URL:</strong>
                        <div className="text-break">{request.downloadUrl || '-'}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Created At:</strong>
                        <div>{formatDateTime(request.createdAt)}</div>
                      </div>
                      <div className="col-md-6 mb-3">
                        <strong>Updated At:</strong>
                        <div>{formatDateTime(request.updatedAt)}</div>
                      </div>
                      <div className="col-md-12">
                        <button className="btn btn-warning btn-sm mr-2" type="button" onClick={() => setShowStatusModal(true)}>
                          Update Status
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {showStatusModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Export Request Status</h5>
                  <button type="button" className="close" onClick={() => setShowStatusModal(false)} disabled={savingStatus}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">New Status</label>
                  <select className="form-control" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="processing">processing</option>
                    <option value="completed">completed</option>
                    <option value="canceled">canceled</option>
                    <option value="stopped">stopped</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowStatusModal(false)} disabled={savingStatus}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdateStatus} disabled={savingStatus}>
                    {savingStatus ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </div>
  );
}
