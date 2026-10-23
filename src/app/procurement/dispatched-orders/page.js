'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { formatDateTime } from '@/lib/dateTime';
import { getWmsStatusLabel } from '@/lib/wmsStatus';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function ProcurementDispatchedOrdersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [trackedLoading, setTrackedLoading] = useState(false);
  const [trackedType, setTrackedType] = useState('');
  const [trackedOrders, setTrackedOrders] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingItem, setTrackingItem] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingError, setTrackingError] = useState('');

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
    const onResize = () => body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isValid, router]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

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
        const backendError = payload?.errors?.error || payload?.message || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }
      return payload;
    },
    [token]
  );

  const loadTrackedOrders = useCallback(async () => {
    if (!token) return;
    setTrackedLoading(true);
    setError('');
    try {
      const qs = trackedType ? `?type=${encodeURIComponent(trackedType)}` : '';
      const data = await apiFetch(`/api/wms/orders${qs}`, { method: 'GET' });
      setTrackedOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load tracked WMS orders.');
      setTrackedOrders([]);
    } finally {
      setTrackedLoading(false);
    }
  }, [apiFetch, token, trackedType]);

  useEffect(() => {
    loadTrackedOrders();
  }, [loadTrackedOrders]);

  const openTrackingModal = (item) => {
    setTrackingItem(item);
    setTrackingNumber('');
    setTrackingError('');
    setShowTrackingModal(true);
  };

  const onSubmitTracking = async () => {
    const orderNo = trackingItem?.orderNo;
    if (!orderNo || !trackingNumber.trim()) {
      setTrackingError('Enter a tracking number.');
      return;
    }
    setTrackingSaving(true);
    setTrackingError('');
    try {
      await apiFetch(`/api/wms/inbound/${orderNo}/set-tracking`, {
        method: 'POST',
        body: JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      setMessage('Tracking number set successfully.');
      setShowTrackingModal(false);
      await loadTrackedOrders();
    } catch (err) {
      setTrackingError(err.message || 'Failed to set tracking number.');
    } finally {
      setTrackingSaving(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading dispatched orders...</div>;

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />
      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Procurement - Dispatched Orders</h4>
              <div className="d-flex" style={{ gap: '8px' }}>
                <select className="form-control" value={trackedType} onChange={(e) => setTrackedType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="return">Return</option>
                </select>
                <button className="btn btn-light" type="button" onClick={loadTrackedOrders} disabled={trackedLoading}>
                  {trackedLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {message ? <div className="alert alert-success">{message}</div> : null}
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Order No</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Waybill</th>
                      <th>Error Count</th>
                      <th>Last Polled</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedOrders.map((item) => {
                      const canSetTracking = item.type === 'inbound' && item.status === 'awaiting_tracking';
                      return (
                      <tr key={`${item.id}-${item.orderNo}`}>
                        <td>{item.orderNo || '-'}</td>
                        <td>{item.type || '-'}</td>
                        <td>{getWmsStatusLabel(item.type, item.status)}</td>
                        <td>{item.waybillNo || '-'}</td>
                        <td>{item.errorCount ?? 0}</td>
                        <td>{formatDateTime(item.lastPolledAt)}</td>
                        <td>{formatDateTime(item.updatedAt)}</td>
                        <td>
                          {canSetTracking ? (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              type="button"
                              onClick={() => openTrackingModal(item)}
                            >
                              Set Tracking
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    )})}
                    {!trackedLoading && trackedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted">
                          No tracked WMS orders found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {showTrackingModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Set Tracking Number</h5>
                  <button type="button" className="close" onClick={() => setShowTrackingModal(false)} disabled={trackingSaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  {trackingError ? <div className="alert alert-danger">{trackingError}</div> : null}
                  <div className="mb-3"><strong>Order No:</strong> {trackingItem?.orderNo || '-'}</div>
                  <label className="form-label">Tracking Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    disabled={trackingSaving}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowTrackingModal(false)} disabled={trackingSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onSubmitTracking} disabled={trackingSaving}>
                    {trackingSaving ? 'Saving...' : 'Save'}
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
