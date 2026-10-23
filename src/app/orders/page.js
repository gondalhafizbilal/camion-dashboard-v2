'use client';

import Link from 'next/link';
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

function mapOrder(order) {
  return {
    uuid: String(order?.uuid || ''),
    customer: order?.customer || null,
    status: String(order?.status || '').toLowerCase(),
    dispatchStatus: String(order?.dispatchStatus || '').toLowerCase(),
    invalidOrder: Boolean(order?.invalidOrder),
    gulltransOrderSns: order?.gulltransOrderSns ?? null,
    total: Number(order?.total?.amount || 0),
    currencyCode: order?.total?.currencyCode || 'USD',
    orderPlacementDate: order?.orderPlacementDate || order?.createdAt || null,
    itemCount: Array.isArray(order?.orderItems) ? order.orderItems.length : 0,
  };
}

function hasGulltransOrderSns(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text.length > 0 && text.toLowerCase() !== 'null';
}

function normalizeGulltransOrderSns(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'null') return [];
  return [text];
}

function isOrderDispatchedByData(order, tracking) {
  const dispatchStatus = String(order?.dispatchStatus || '').toLowerCase().replace(/\s+/g, '_');
  const statusSaysNotDispatched = dispatchStatus === 'not_dispatched';

  if (statusSaysNotDispatched) {
    return hasGulltransOrderSns(order?.gulltransOrderSns);
  }

  return hasGulltransOrderSns(order?.gulltransOrderSns) || Boolean(tracking);
}

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
  'delivered',
  'payment_pending',
  'payment_successful',
  'payment_rejected',
  'return_requested',
  'returned',
];

const SHIPPER_METHODS = [
  { value: 0, label: 'Sea' },
  { value: 1, label: 'Air' },
  { value: 2, label: 'Express' },
  { value: 3, label: 'Rail' },
  { value: 4, label: 'Land' },
];

const ORDER_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  delivered: 'Delivered',
  payment_pending: 'Payment Pending',
  payment_successful: 'Payment Successful',
  payment_rejected: 'Payment Rejected',
  return_requested: 'Return Requested',
  returned: 'Returned',
};

function getOrderStatusLabel(status) {
  const key = String(status || '').toLowerCase();
  if (ORDER_STATUS_LABELS[key]) return ORDER_STATUS_LABELS[key];
  if (!key) return '-';
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDisplayValue(value) {
  const text = String(value || '').trim();
  return text.length > 0 ? text : 'N/A';
}

function getInvalidLabel(isInvalid) {
  return isInvalid ? 'Invalid' : 'Valid';
}

const COMPACT_BADGE_STYLE = {
  fontSize: '11px',
  lineHeight: 1.2,
  padding: '4px 8px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'fit-content',
};

const ORDER_CURRENCY = 'qar';

export default function OrdersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dispatchFilter, setDispatchFilter] = useState('all');
  const [invalidOrderFilter, setInvalidOrderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageNumber, setPageNumber] = useState(1);
  const [orders, setOrders] = useState([]);
  const [dispatchByOrderUuid, setDispatchByOrderUuid] = useState({});
  const [selectedDispatchOrderUuids, setSelectedDispatchOrderUuids] = useState([]);
  const [dispatchSubmitting, setDispatchSubmitting] = useState(false);
  const [dispatchShipperMethod, setDispatchShipperMethod] = useState(1);
  const [dispatchShipperCompany, setDispatchShipperCompany] = useState('');
  const [customerUuid, setCustomerUuid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [nextStatus, setNextStatus] = useState('pending');

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

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setCustomerUuid(String(params.get('customerUuid') || '').trim());
  }, []);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

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

  const loadOrders = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const activeCustomerUuid = String(
        customerUuid || new URL(window.location.href).searchParams.get('customerUuid') || ''
      ).trim();
      const filtersPayload = {};
      const searchTerm = search.trim();
      if (searchTerm) {
        filtersPayload.search = searchTerm;
      }
      if (activeCustomerUuid) {
        filtersPayload.customerUUID = activeCustomerUuid;
      }
      if (invalidOrderFilter === 'invalid_only') {
        filtersPayload.invalidOrder = true;
      }
      const filters = JSON.stringify(filtersPayload);
      const sort = `${sortBy}:${sortDir}`;

      const params = new URLSearchParams({
        filters,
        sort,
        currency: ORDER_CURRENCY,
        pageNumber: String(pageNumber),
        itemsPerPage: String(itemsPerPage),
      });
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const [ordersData, trackedData] = await Promise.all([
        apiFetch(`/api/orders?${params.toString()}`, { method: 'GET' }),
        apiFetch('/api/wms/orders', { method: 'GET' }),
      ]);
      const mapped = Array.isArray(ordersData) ? ordersData.map(mapOrder) : [];

      const dispatchMap = {};
      const tracked = Array.isArray(trackedData) ? trackedData : [];
      tracked.forEach((item) => {
        const sourceOrderUuids = String(item?.sourceOrderUuids || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        sourceOrderUuids.forEach((orderUuid) => {
          const current = dispatchMap[orderUuid];
          const nextType = String(item?.type || '').toLowerCase();
          const nextStatus = String(item?.status || '').toLowerCase();
          if (!current) {
            dispatchMap[orderUuid] = { type: nextType, status: nextStatus };
            return;
          }
          if (current.type !== 'outbound' && nextType === 'outbound') {
            dispatchMap[orderUuid] = { type: nextType, status: nextStatus };
          }
        });
      });

      setDispatchByOrderUuid(dispatchMap);

      const filtered = mapped.filter((order) => {
        if (dispatchFilter === 'all') return true;
        const tracking = dispatchMap[order.uuid];
        const isDispatched = isOrderDispatchedByData(order, tracking);
        if (dispatchFilter === 'dispatched') return isDispatched;
        if (dispatchFilter === 'not_dispatched') return !isDispatched;
        return true;
      });

      setOrders(filtered);
      setSelectedDispatchOrderUuids((prev) => prev.filter((uuid) => filtered.some((order) => order.uuid === uuid)));
    } catch (err) {
      setError(err.message || 'Failed to load orders.');
      setOrders([]);
      setDispatchByOrderUuid({});
      setSelectedDispatchOrderUuids([]);
    } finally {
      setLoading(false);
    }
  }, [
    apiFetch,
    customerUuid,
    dispatchFilter,
    invalidOrderFilter,
    itemsPerPage,
    pageNumber,
    search,
    sortBy,
    sortDir,
    statusFilter,
    token,
  ]);

  const getDispatchStatusLabel = useCallback(
    (order) => {
      const tracking = dispatchByOrderUuid[order?.uuid];
      const isDispatched = isOrderDispatchedByData(order, tracking);
      if (!isDispatched) return 'Not Dispatched';
      if (hasGulltransOrderSns(order?.gulltransOrderSns)) return 'Dispatched';
      if (!tracking) return 'Dispatched';
      const type = String(tracking.type || '').toLowerCase();
      const statusLabel = getWmsStatusLabel(type, tracking.status);
      if (type === 'outbound') return `Outbound: ${statusLabel}`;
      if (type === 'inbound') return `Inbound: ${statusLabel}`;
      if (type === 'return') return `Return: ${statusLabel}`;
      return `Tracked: ${statusLabel}`;
    },
    [dispatchByOrderUuid]
  );

  const isOrderDispatched = useCallback(
    (order) => {
      if (!order?.uuid) return false;
      const tracking = dispatchByOrderUuid[order.uuid];
      return isOrderDispatchedByData(order, tracking);
    },
    [dispatchByOrderUuid]
  );

  const eligibleOrderUuids = useMemo(
    () => orders.filter((order) => order.uuid && !isOrderDispatched(order)).map((order) => order.uuid),
    [isOrderDispatched, orders]
  );

  const allEligibleSelected = useMemo(
    () => eligibleOrderUuids.length > 0 && eligibleOrderUuids.every((uuid) => selectedDispatchOrderUuids.includes(uuid)),
    [eligibleOrderUuids, selectedDispatchOrderUuids]
  );

  const onToggleSelectAllEligible = useCallback(
    (checked) => {
      if (!checked) {
        setSelectedDispatchOrderUuids([]);
        return;
      }
      setSelectedDispatchOrderUuids(eligibleOrderUuids);
    },
    [eligibleOrderUuids]
  );

  const onToggleDispatchSelection = useCallback(
    (order) => {
      const orderUuid = order?.uuid;
      if (!orderUuid || isOrderDispatched(order)) return;
      setSelectedDispatchOrderUuids((prev) =>
        prev.includes(orderUuid) ? prev.filter((id) => id !== orderUuid) : [...prev, orderUuid]
      );
    },
    [isOrderDispatched]
  );

  const onDispatchSelectedOrders = useCallback(async () => {
    if (!selectedDispatchOrderUuids.length) {
      setError('Please select at least one non-dispatched order.');
      return;
    }
    if (!Number.isInteger(Number(dispatchShipperMethod))) {
      setError('Shipper method is required.');
      return;
    }

    setDispatchSubmitting(true);
    setError('');
    setMessage('');

    try {
      const body = {
        orderUuids: selectedDispatchOrderUuids,
        shipperMethod: Number(dispatchShipperMethod),
      };
      if (dispatchShipperCompany.trim()) {
        body.shipperCompany = dispatchShipperCompany.trim();
      }

      const payload = await apiFetch('/api/wms/orders/dispatch', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setMessage(
        payload?.jobId
          ? `Dispatch started for selected orders. Job ID: ${payload.jobId}`
          : 'Dispatch request submitted successfully.'
      );
      setSelectedDispatchOrderUuids([]);
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to dispatch selected orders.');
    } finally {
      setDispatchSubmitting(false);
    }
  }, [
    apiFetch,
    dispatchShipperCompany,
    dispatchShipperMethod,
    loadOrders,
    selectedDispatchOrderUuids,
  ]);

  const onOpenStatusModal = useCallback((order) => {
    setSelectedOrder(order);
    setNextStatus(order?.status || 'pending');
    setShowStatusModal(true);
  }, []);

  const onUpdateStatus = useCallback(async () => {
    if (!selectedOrder?.uuid || !nextStatus) return;
    setStatusSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/orders/${selectedOrder.uuid}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage('Order status updated successfully.');
      setShowStatusModal(false);
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Failed to update order status.');
    } finally {
      setStatusSaving(false);
    }
  }, [apiFetch, loadOrders, nextStatus, selectedOrder?.uuid]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  if (!isValid) {
    return <div className="screen-center">Loading orders...</div>;
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
                  <h4 className="card-title mb-0">Order Listing</h4>
                  <span className="text-muted">Live API Data</span>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="row mb-3">
                    <div className="col-md-4 mb-2">
                      <label className="form-label">Search</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="UUID, customer, item"
                        value={search}
                        onChange={(e) => {
                          setPageNumber(1);
                          setSearch(e.target.value);
                        }}
                      />
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label">Status</label>
                      <select
                        className="form-control"
                        value={statusFilter}
                        onChange={(e) => {
                          setPageNumber(1);
                          setStatusFilter(e.target.value);
                        }}
                      >
                        <option value="all">All</option>
                        <option value="payment_pending">Payment Pending</option>
                        <option value="payment_successful">Payment Successful</option>
                        <option value="payment_rejected">Payment Rejected</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="return_requested">Return Requested</option>
                        <option value="returned">Returned</option>
                      </select>
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label">Dispatch</label>
                      <select
                        className="form-control"
                        value={dispatchFilter}
                        onChange={(e) => {
                          setPageNumber(1);
                          setDispatchFilter(e.target.value);
                        }}
                      >
                        <option value="all">All</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="not_dispatched">Not Dispatched</option>
                      </select>
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label">Invalid</label>
                      <select
                        className="form-control"
                        value={invalidOrderFilter}
                        onChange={(e) => {
                          setPageNumber(1);
                          setInvalidOrderFilter(e.target.value);
                        }}
                      >
                        <option value="all">All</option>
                        <option value="invalid_only">Invalid Only</option>
                      </select>
                    </div>
                    <div className="col-md-2 mb-2">
                      <label className="form-label">Sort By</label>
                      <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="orderPlacementDate">Order Placement Date</option>
                        <option value="createdAt">Created At</option>
                        <option value="uuid">UUID</option>
                        <option value="status">Status</option>
                        <option value="total">Total</option>
                      </select>
                    </div>
                    <div className="col-md-1 mb-2">
                      <label className="form-label">Dir</label>
                      <select className="form-control" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                    <div className="col-md-1 mb-2">
                      <label className="form-label">Items/Page</label>
                      <select
                        className="form-control"
                        value={itemsPerPage}
                        onChange={(e) => {
                          setPageNumber(1);
                          setItemsPerPage(Number(e.target.value));
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <div className="col-md-1 mb-2 d-flex align-items-end">
                      <button className="btn btn-primary btn-sm w-100" onClick={loadOrders} type="button" disabled={loading}>
                        {loading ? '...' : 'Go'}
                      </button>
                    </div>
                  </div>

                  <div className="row mb-3">
                    <div className="col-md-3 mb-2">
                      <label className="form-label">Dispatch Shipper Method</label>
                      <select
                        className="form-control"
                        value={dispatchShipperMethod}
                        onChange={(e) => setDispatchShipperMethod(Number(e.target.value))}
                      >
                        {SHIPPER_METHODS.map((method) => (
                          <option key={method.value} value={method.value}>
                            {method.label} ({method.value})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-5 mb-2">
                      <label className="form-label">Dispatch Shipper Company (Optional)</label>
                      <input
                        className="form-control"
                        placeholder="DHL Freight"
                        value={dispatchShipperCompany}
                        onChange={(e) => setDispatchShipperCompany(e.target.value)}
                      />
                    </div>
                    <div className="col-md-4 mb-2 d-flex align-items-end justify-content-end">
                      <button
                        className="btn btn-success"
                        type="button"
                        onClick={onDispatchSelectedOrders}
                        disabled={dispatchSubmitting || selectedDispatchOrderUuids.length === 0}
                      >
                        {dispatchSubmitting
                          ? 'Dispatching...'
                          : `Dispatch Selected Orders (${selectedDispatchOrderUuids.length})`}
                      </button>
                    </div>
                  </div>

                  {loading ? <p className="mb-2">Loading orders...</p> : null}

                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th style={{ width: '44px' }}>
                            <input
                              type="checkbox"
                              checked={allEligibleSelected}
                              onChange={(e) => onToggleSelectAllEligible(e.target.checked)}
                              disabled={eligibleOrderUuids.length === 0}
                              title="Select all non-dispatched orders"
                            />
                          </th>
                          <th>Order</th>
                          <th>Customer Info</th>
                          <th>Status</th>
                          <th>Flag</th>
                          <th>Gul Trans Order No(s)</th>
                          <th>Total</th>
                          <th>Items</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.uuid}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedDispatchOrderUuids.includes(order.uuid)}
                                onChange={() => onToggleDispatchSelection(order)}
                                disabled={isOrderDispatched(order)}
                                title={isOrderDispatched(order) ? 'Already dispatched' : 'Select for dispatch'}
                              />
                            </td>
                            <td style={{ minWidth: '220px' }}>
                              <div>{formatDateTime(order.orderPlacementDate)}</div>
                              <small className="text-muted d-block">{order.uuid || '-'}</small>
                            </td>
                            <td>
                              <div>{getDisplayValue(order?.customer?.fullName)}</div>
                              <small className="text-muted d-block">{getDisplayValue(order?.customer?.emailAddress)}</small>
                              <small className="text-muted d-block">{getDisplayValue(order?.customer?.phoneNumber)}</small>
                            </td>
                            <td>
                              <span className="badge badge-light" style={COMPACT_BADGE_STYLE}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </td>
                            <td style={{ minWidth: '150px' }}>
                              <div className="d-flex flex-column" style={{ gap: '6px' }}>
                                <span
                                  className={`badge ${order.invalidOrder ? 'badge-warning' : 'badge-success'}`}
                                  style={COMPACT_BADGE_STYLE}
                                >
                                  {getInvalidLabel(order.invalidOrder)}
                                </span>
                                <span
                                  className={`badge ${isOrderDispatched(order) ? 'badge-info' : 'badge-secondary'}`}
                                  style={COMPACT_BADGE_STYLE}
                                >
                                  {isOrderDispatched(order) ? 'Dispatch' : 'Not Dispatch'}
                                </span>
                              </div>
                            </td>
                            <td style={{ minWidth: '220px' }}>
                              {normalizeGulltransOrderSns(order.gulltransOrderSns).length > 0 ? (
                                <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                  {normalizeGulltransOrderSns(order.gulltransOrderSns).map((sns) => (
                                    <span key={`${order.uuid}-${sns}`} className="badge badge-primary">
                                      {sns}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>
                              {order.currencyCode} {Number(order.total || 0).toFixed(2)}
                            </td>
                            <td>{order.itemCount}</td>
                            <td>
                              <div className="d-flex" style={{ gap: '8px' }}>
                                <Link className="btn btn-outline-secondary btn-sm" href={`/orders/${order.uuid}`}>
                                  View
                                </Link>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => onOpenStatusModal(order)}
                                >
                                  Update Status
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {!loading && orders.length === 0 ? (
                          <tr>
                              <td colSpan={9} className="text-center text-muted">
                              No orders found.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <small className="text-muted">Fetched {orders.length} orders on this page</small>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button
                        className="btn btn-light btn-sm"
                        type="button"
                        disabled={pageNumber <= 1 || loading}
                        onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" type="button" disabled>
                        Page {pageNumber}
                      </button>
                      <button
                        className="btn btn-light btn-sm"
                        type="button"
                        disabled={orders.length < itemsPerPage || loading}
                        onClick={() => setPageNumber((prev) => prev + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
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
                  <h5 className="modal-title">Update Order Status</h5>
                  <button type="button" className="close" onClick={() => setShowStatusModal(false)} disabled={statusSaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-2"><strong>Order UUID:</strong> {selectedOrder?.uuid || '-'}</div>
                  <div className="mb-3"><strong>Current Status:</strong> {getOrderStatusLabel(selectedOrder?.status)}</div>
                  <label className="form-label">New Status</label>
                  <select className="form-control" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getOrderStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowStatusModal(false)} disabled={statusSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdateStatus} disabled={statusSaving}>
                    {statusSaving ? 'Updating...' : 'Update'}
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
