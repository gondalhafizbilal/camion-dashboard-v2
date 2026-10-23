'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

const SHIPPER_METHODS = [
  { value: 0, label: 'Sea' },
  { value: 1, label: 'Air' },
  { value: 2, label: 'Express' },
  { value: 3, label: 'Rail' },
  { value: 4, label: 'Land' },
];

const ORDER_CURRENCY = 'qar';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function ProcurementDispatchOrdersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderUuids, setSelectedOrderUuids] = useState([]);
  const [shipperMethod, setShipperMethod] = useState(1);
  const [shipperCompany, setShipperCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
        const alreadyDispatched = Array.isArray(payload?.alreadyDispatched)
          ? payload.alreadyDispatched
          : Array.isArray(payload?.details?.alreadyDispatchedOrderUuids)
            ? payload.details.alreadyDispatchedOrderUuids
            : [];
        const details =
          alreadyDispatched.length
            ? ` Already dispatched: ${alreadyDispatched.join(', ')}`
            : '';
        const backendError = payload?.errors?.error || payload?.message || payload?.error || 'Request failed.';
        throw new Error(`${backendError}${details}`);
      }
      return payload;
    },
    [token]
  );

  const loadOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/orders?pageNumber=1&itemsPerPage=100&status=confirmed&currency=${ORDER_CURRENCY}`, { method: 'GET' });
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load confirmed orders.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);


  const toggleOrder = (uuid) => {
    setSelectedOrderUuids((prev) => (prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid]));
  };

  const toggleAll = (checked) => {
    if (!checked) {
      setSelectedOrderUuids([]);
      return;
    }
    setSelectedOrderUuids(orders.map((o) => o.uuid).filter(Boolean));
  };

  const onDispatch = async () => {
    if (!Number.isInteger(Number(shipperMethod))) {
      setError('Shipper method is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const body = {
        shipperMethod: Number(shipperMethod),
      };
      if (shipperCompany.trim()) body.shipperCompany = shipperCompany.trim();
      if (selectedOrderUuids.length) body.orderUuids = selectedOrderUuids;
      const payload = await apiFetch('/api/wms/orders/dispatch', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage(
        payload?.jobId
          ? `Dispatch started successfully. Job ID: ${payload.jobId}`
          : 'Dispatch request submitted successfully.'
      );
      setSelectedOrderUuids([]);
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to dispatch orders.');
    } finally {
      setSubmitting(false);
    }
  };

  const allSelected = orders.length > 0 && selectedOrderUuids.length === orders.length;

  if (!isValid) return <div className="screen-center">Loading dispatch...</div>;

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />
      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Procurement - Dispatch Orders</h4>
              <button className="btn btn-light btn-sm" type="button" onClick={loadOrders} disabled={loading}>
                Refresh
              </button>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {message ? <div className="alert alert-success">{message}</div> : null}

              <div className="row mb-3">
                <div className="col-md-3">
                  <label className="form-label">Shipper Method</label>
                  <select
                    className="form-control"
                    value={shipperMethod}
                    onChange={(e) => setShipperMethod(Number(e.target.value))}
                  >
                    {SHIPPER_METHODS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.value})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-5">
                  <label className="form-label">Shipper Company (Optional)</label>
                  <input
                    className="form-control"
                    value={shipperCompany}
                    onChange={(e) => setShipperCompany(e.target.value)}
                    placeholder="DHL Freight"
                  />
                </div>
                <div className="col-md-4 d-flex align-items-end justify-content-end">
                  <button className="btn btn-primary" type="button" onClick={onDispatch} disabled={submitting}>
                    {submitting
                      ? 'Dispatching...'
                      : selectedOrderUuids.length
                        ? `Dispatch Selected (${selectedOrderUuids.length})`
                        : 'Dispatch All Eligible'}
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th style={{ width: '52px' }}>
                        <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
                      </th>
                      <th>Order UUID</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Address</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.uuid}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedOrderUuids.includes(order.uuid)}
                            onChange={() => toggleOrder(order.uuid)}
                          />
                        </td>
                        <td>{order.uuid}</td>
                        <td>{order.status}</td>
                        <td>{order?.shippingAddress?.fullName || order?.customer?.fullName || '-'}</td>
                        <td>
                          {order?.shippingAddress
                            ? `${order.shippingAddress.streetAddress || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.country || ''}`
                            : '-'}
                        </td>
                        <td>{Array.isArray(order?.orderItems) ? order.orderItems.length : 0}</td>
                      </tr>
                    ))}
                    {!loading && orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">
                          No confirmed orders found.
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
    </div>
  );
}
