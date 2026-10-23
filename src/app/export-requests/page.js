'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import ExportRequestsSection from '@/components/export-requests/ExportRequestsSection';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function normalizeRequestError(payload) {
  const backendErrors = payload?.errors || {};
  return {
    name: backendErrors?.name || '',
    status: backendErrors?.status || '',
    error: backendErrors?.error || payload?.message || '',
  };
}

export default function ExportRequestsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState('pending');
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleteLoadingUuid, setDeleteLoadingUuid] = useState('');

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

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        pageNumber: String(pageNumber),
        itemsPerPage: String(itemsPerPage),
      });
      const data = await apiFetch(`/api/export-requests?${params.toString()}`, { method: 'GET' });
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load export requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, itemsPerPage, pageNumber, token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onDeleteRequest = async (uuid) => {
    if (!uuid) return;
    const ok = window.confirm('Delete this export request?');
    if (!ok) return;

    setDeleteLoadingUuid(uuid);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/export-requests/${uuid}`, { method: 'DELETE' });
      setMessage('Export request deleted.');
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to delete export request.');
    } finally {
      setDeleteLoadingUuid('');
    }
  };

  const onOpenStatusModal = (request) => {
    setSelectedRequest(request);
    setNextStatus(request?.status || 'pending');
    setShowStatusModal(true);
  };

  const onUpdateStatus = async () => {
    if (!selectedRequest?.uuid || !nextStatus) return;

    setSavingStatus(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/export-requests/${selectedRequest.uuid}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage('Export request status updated.');
      setShowStatusModal(false);
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to update export request status.');
    } finally {
      setSavingStatus(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading export requests...</div>;
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
                  <h4 className="card-title mb-0">Export Requests Management</h4>
                  <Link href="/export-requests/new" className="btn btn-primary btn-sm">
                    Create Export Request
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <ExportRequestsSection
                    loading={loading}
                    requests={requests}
                    pageNumber={pageNumber}
                    setPageNumber={setPageNumber}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    onRefresh={loadRequests}
                    onDeleteRequest={onDeleteRequest}
                    onOpenStatusModal={onOpenStatusModal}
                    deleteLoadingUuid={deleteLoadingUuid}
                  />
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
                  <div className="mb-2">
                    <strong>Name:</strong> {selectedRequest?.name || '-'}
                  </div>
                  <div className="mb-2">
                    <strong>Format:</strong> {selectedRequest?.format || '-'}
                  </div>
                  <div className="mb-3">
                    <strong>Current Status:</strong> {selectedRequest?.status || '-'}
                  </div>
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
