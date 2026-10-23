'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import ExportRequestForm from '@/components/export-requests/ExportRequestForm';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function normalizeErrors(payload) {
  const backendErrors = payload?.errors || {};
  return {
    name: backendErrors?.name || '',
    error: backendErrors?.error || backendErrors?.type || payload?.message || '',
  };
}

export default function ExportRequestEditPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = String(params?.uuid || '').trim();
  const [menuToggled, setMenuToggled] = useState(false);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({ name: '' });
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
        throw Object.assign(new Error(backendError), { payload });
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
      setFormData({ name: data?.name || '' });
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

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!uuid) return;
    setSaving(true);
    setError('');
    setMessage('');
    setErrors({});
    try {
      await apiFetch(`/api/export-requests/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        body: JSON.stringify({ name: String(formData.name || '').trim() }),
      });
      setMessage('Export request updated.');
      await loadRequest();
    } catch (err) {
      const normalized = normalizeErrors(err.payload || {});
      setErrors(normalized);
      setError(normalized.error || err.message || 'Failed to update export request.');
    } finally {
      setSaving(false);
    }
  };

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
                  <h4 className="card-title mb-0">Edit Export Request</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/export-requests/${uuid}`} className="btn btn-outline-primary btn-sm">
                      View
                    </Link>
                    <Link href="/export-requests" className="btn btn-outline-secondary btn-sm">
                      Back
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  {loading ? (
                    <p className="mb-0">Loading export request...</p>
                  ) : request ? (
                    <ExportRequestForm
                      mode="edit"
                      formData={formData}
                      setFormData={setFormData}
                      errors={errors}
                      saving={saving}
                      onSubmit={onSubmit}
                      onCancel={() => router.push(`/export-requests/${uuid}`)}
                      request={request}
                    />
                  ) : null}

                  {request ? (
                    <div className="mt-4">
                      <button className="btn btn-warning btn-sm" type="button" onClick={() => setShowStatusModal(true)}>
                        Update Status
                      </button>
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
