'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { formatDateTime } from '@/lib/dateTime';
import { getTransformedImageUrl } from '@/lib/imageUrl';

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
  return ORDER_STATUS_LABELS[key] || key || '-';
}

function getDispatchStageLabel(stage) {
  const key = String(stage || '').toLowerCase();
  if (key === 'order') return 'Not Dispatched';
  if (key === 'inbound') return 'Dispatched (Inbound)';
  if (key === 'outbound') return 'Dispatched (Outbound)';
  return key ? 'Dispatched' : 'Unknown';
}

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

function prettyWmsType(type) {
  const key = String(type || '').toLowerCase();
  if (key === 'inbound') return 'Inbound';
  if (key === 'outbound') return 'Outbound';
  if (key === 'return') return 'Return';
  return key || '-';
}

function get1688OfferUrl(procurementId) {
  const value = String(procurementId || '').trim();
  return value ? `https://detail.1688.com/offer/${encodeURIComponent(value)}.html` : '';
}

function getTrackingUrl(order) {
  const value = String(order?.tracking?.trackingUrl || '').trim();
  return value || '';
}

function getProcurementId(product) {
  return String(product?.procurementId || product?.procurement_id || '').trim();
}

function hasSkuMeta(variant) {
  return Boolean(variant?.skuMeta && typeof variant.skuMeta === 'object' && Object.keys(variant.skuMeta).length > 0);
}

function getItemSku(item) {
  return String(item?.sku || item?.variant?.sku || '').trim();
}

const ORDER_CURRENCY = 'qar';

function VariantPicker({ apiFetch, selectedVariant, onSelectVariant, disabled }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const onSearchSku = async () => {
    const sku = query.trim();
    if (!sku) return;
    setSearching(true);
    setLookupError('');
    onSelectVariant(null);
    try {
      const variant = await apiFetch(`/api/products/variants/by-sku/${encodeURIComponent(sku)}`, { method: 'GET' });
      if (variant?.uuid) {
        onSelectVariant(variant);
      } else {
        setLookupError(`No item found with SKU "${sku}".`);
      }
    } catch (err) {
      if (err.status === 404) {
        setLookupError(`No item found with SKU "${sku}".`);
      } else {
        setLookupError(err.message || 'Failed to search for SKU.');
      }
    } finally {
      setSearching(false);
    }
  };

  const onChangeSelection = () => {
    onSelectVariant(null);
    setQuery('');
    setLookupError('');
  };

  return (
    <div className="mb-3">
      <label className="form-label">Find Item by Exact SKU</label>
      {selectedVariant ? (
        <div className="d-flex align-items-center justify-content-between border border-success rounded p-2">
          <div>
            <div className="font-weight-bold">
              {selectedVariant?.product?.titleEn || selectedVariant?.product?.titleAr || selectedVariant.sku || selectedVariant.uuid}
            </div>
            <div className="text-muted small">
              SKU: {selectedVariant.sku || selectedVariant.uuid}
              {selectedVariant.price ? ` — ${amountView(selectedVariant.price)}` : ''}
            </div>
          </div>
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={onChangeSelection} disabled={disabled}>
            Change
          </button>
        </div>
      ) : (
        <>
          <div className="d-flex mb-2" style={{ gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Enter exact SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled || searching}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchSku();
                }
              }}
            />
            <button className="btn btn-outline-secondary" type="button" onClick={onSearchSku} disabled={disabled || searching}>
              {searching ? 'Processing...' : 'Search'}
            </button>
          </div>
          {lookupError ? <div className="text-danger small mb-2">{lookupError}</div> : null}
        </>
      )}
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [mounted, setMounted] = useState(false);
  const [menuToggled, setMenuToggled] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState('pending');
  const [statusSaving, setStatusSaving] = useState(false);
  const [syncOutboundSaving, setSyncOutboundSaving] = useState(false);

  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyItem, setQtyItem] = useState(null);
  const [qtyValue, setQtyValue] = useState(1);
  const [qtySaving, setQtySaving] = useState(false);

  const [removingSku, setRemovingSku] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeItem, setRemoveItem] = useState(null);

  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceItem, setReplaceItem] = useState(null);
  const [replaceVariant, setReplaceVariant] = useState(null);
  const [replaceQuantity, setReplaceQuantity] = useState(1);
  const [replaceSaving, setReplaceSaving] = useState(false);
  const [replaceError, setReplaceError] = useState('');
  const [replaceErrorDetails, setReplaceErrorDetails] = useState('');

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemVariant, setAddItemVariant] = useState(null);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemSaving, setAddItemSaving] = useState(false);
  const [addItemError, setAddItemError] = useState('');
  const [addItemErrorDetails, setAddItemErrorDetails] = useState('');

  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingWmsOrder, setTrackingWmsOrder] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingModalError, setTrackingModalError] = useState('');

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  useEffect(() => {
    setMounted(true);
  }, []);

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
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || payload?.error || 'Request failed.';
        const err = new Error(backendError);
        err.status = response.status;
        if (payload?.details) err.details = payload.details;
        throw err;
      }
      return payload;
    },
    [token]
  );

  const loadOrder = useCallback(async () => {
    if (!token || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/orders/${uuid}?currency=${ORDER_CURRENCY}`, { method: 'GET' });
      setOrder(data || null);
      setNextStatus(String(data?.status || 'pending').toLowerCase());
    } catch (err) {
      setError(err.message || 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const stage = String(order?.tracking?.stage || '').toLowerCase();
  const canRetryOutbound = Boolean(order?.tracking?.canRetryOutbound);
  const isDispatched = stage === 'inbound' || stage === 'outbound';

  const itemsComputedTotal = useMemo(() => {
    const validItems = (order?.orderItems || []).filter((item) => !item?.invalidOrderItem);
    if (validItems.length === 0) return null;
    const currencyCode = validItems.find((item) => item?.total?.currencyCode)?.total?.currencyCode || '';
    const amount = validItems.reduce((sum, item) => sum + Number(item?.total?.amount || 0), 0);
    return { amount, currencyCode };
  }, [order]);

  const showDriftWarning = useMemo(() => {
    if (String(order?.status || '').toLowerCase() !== 'payment_successful') return false;
    if (!itemsComputedTotal || !order?.total) return false;
    return Number(itemsComputedTotal.amount) !== Number(order.total.amount);
  }, [order, itemsComputedTotal]);

  const onUpdateStatus = useCallback(async () => {
    if (!uuid || !nextStatus) return;
    setStatusSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/orders/${uuid}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage('Order status updated successfully.');
      setShowStatusModal(false);
      await loadOrder();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setStatusSaving(false);
    }
  }, [apiFetch, loadOrder, nextStatus, uuid]);

  const onSyncOutbound = useCallback(async () => {
    if (!uuid) return;
    setSyncOutboundSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await apiFetch(`/api/wms/orders/${uuid}/sync-outbound`, { method: 'POST' });
      setMessage(data?.message || 'Outbound synced successfully.');
      await loadOrder();
    } catch (err) {
      setError(err.message || 'Failed to sync outbound.');
    } finally {
      setSyncOutboundSaving(false);
    }
  }, [apiFetch, loadOrder, uuid]);

  const openQtyModal = (item) => {
    setQtyItem(item);
    setQtyValue(item?.quantity ?? 1);
    setShowQtyModal(true);
  };

  const onSaveQty = async () => {
    const sku = getItemSku(qtyItem);
    if (!sku || !qtyValue) return;
    setQtySaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/orders/${uuid}/item-quantity`, {
        method: 'PATCH',
        body: JSON.stringify({ sku, quantity: Number(qtyValue) }),
      });
      setMessage('Item quantity updated successfully.');
      setShowQtyModal(false);
      await loadOrder();
    } catch (err) {
      setError(err.message || 'Failed to update item quantity.');
    } finally {
      setQtySaving(false);
    }
  };

  const openRemoveModal = (item) => {
    if (!getItemSku(item)) return;
    setRemoveItem(item);
    setShowRemoveModal(true);
  };

  const onConfirmRemove = async () => {
    const sku = getItemSku(removeItem);
    if (!sku) return;
    setRemovingSku(sku);
    setShowRemoveModal(false);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/orders/${uuid}/remove-item`, {
        method: 'POST',
        body: JSON.stringify({ sku }),
      });
      setMessage('Item removed successfully.');
      await loadOrder();
    } catch (err) {
      setError(err.message || 'Failed to remove item.');
    } finally {
      setRemovingSku('');
    }
  };

  const openReplaceModal = (item) => {
    setReplaceItem(item);
    setReplaceVariant(null);
    setReplaceQuantity(item?.quantity ?? 1);
    setReplaceError('');
    setReplaceErrorDetails('');
    setShowReplaceModal(true);
  };

  const onSubmitReplace = async () => {
    const oldSku = getItemSku(replaceItem);
    if (!oldSku || !replaceVariant?.uuid || !replaceQuantity) {
      setReplaceError('Select a replacement variant and quantity.');
      return;
    }
    setReplaceSaving(true);
    setReplaceError('');
    setReplaceErrorDetails('');
    try {
      const body = {
        oldSku,
        variantUuid: replaceVariant.uuid,
        quantity: Number(replaceQuantity),
      };
      const data = await apiFetch(`/api/wms/orders/${uuid}/replace-item`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const ref = data?.hiobuyOrderId ?? data?.gulltransOrderSn;
      setMessage(`Item replaced successfully.${ref ? ` Procurement ref: ${ref}` : ''}`);
      setShowReplaceModal(false);
      await loadOrder();
    } catch (err) {
      setReplaceError(err.message || 'Failed to replace item.');
      setReplaceErrorDetails(err.details || '');
    } finally {
      setReplaceSaving(false);
    }
  };

  const openAddItemModal = () => {
    setAddItemVariant(null);
    setAddItemQuantity(1);
    setAddItemError('');
    setAddItemErrorDetails('');
    setShowAddItemModal(true);
  };

  const onSubmitAddItem = async () => {
    if (!addItemVariant?.uuid || !addItemQuantity) {
      setAddItemError('Select a variant and quantity.');
      return;
    }
    setAddItemSaving(true);
    setAddItemError('');
    setAddItemErrorDetails('');
    try {
      const body = {
        variantUuid: addItemVariant.uuid,
        quantity: Number(addItemQuantity),
      };
      await apiFetch(`/api/orders/${uuid}/add-item`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setMessage('Item added successfully.');
      setShowAddItemModal(false);
      await loadOrder();
    } catch (err) {
      setAddItemError(err.message || 'Failed to add item.');
      setAddItemErrorDetails(err.details || '');
    } finally {
      setAddItemSaving(false);
    }
  };

  const openTrackingModal = (wmsOrder) => {
    setTrackingWmsOrder(wmsOrder);
    setTrackingNumber('');
    setTrackingModalError('');
    setShowTrackingModal(true);
  };

  const onSubmitTracking = async () => {
    const orderNo = trackingWmsOrder?.orderNo;
    if (!orderNo || !trackingNumber.trim()) {
      setTrackingModalError('Enter a tracking number.');
      return;
    }
    setTrackingSaving(true);
    setTrackingModalError('');
    try {
      await apiFetch(`/api/wms/inbound/${orderNo}/set-tracking`, {
        method: 'POST',
        body: JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      setMessage('Tracking number set successfully.');
      setShowTrackingModal(false);
      await loadOrder();
    } catch (err) {
      setTrackingModalError(err.message || 'Failed to set tracking number.');
    } finally {
      setTrackingSaving(false);
    }
  };

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  if (!mounted || !isValid) return <div className="screen-center">Loading order...</div>;

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Order Details</h4>
              <div className="d-flex" style={{ gap: '8px' }}>
                <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => router.push('/orders')}>
                  Back to Orders
                </button>
                <button className="btn btn-success btn-sm" type="button" onClick={openAddItemModal} disabled={!order}>
                  Add Item
                </button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setShowStatusModal(true)} disabled={!order}>
                  Update Status
                </button>
              </div>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {message ? <div className="alert alert-success">{message}</div> : null}
              {loading ? <p>Loading order...</p> : null}

              {!loading && order ? (
                <>
                  {showDriftWarning ? (
                    <div className="alert alert-warning">
                      <strong>Totals mismatch</strong> — this order&apos;s current items no longer match its charged
                      total (items were likely added/removed/replaced after checkout). Any refund or extra charge
                      must be handled manually; there&apos;s no automatic reconciliation.
                    </div>
                  ) : null}

                  <h5 className="h5-heading mt-2">Order Overview</h5>
                  <div className="table-responsive mb-4">
                    <table className="table table-bordered mb-0">
                      <tbody>
                        <tr><th style={{ width: '280px' }}>UUID</th><td>{order.uuid || '-'}</td></tr>
                        <tr><th>Status</th><td>{getOrderStatusLabel(order.status)}</td></tr>
                        <tr>
                          <th>Dispatch Stage</th>
                          <td>
                            {getDispatchStageLabel(stage)}
                            {isDispatched ? (
                              <button
                                className="btn btn-sm btn-outline-secondary ml-2"
                                type="button"
                                onClick={onSyncOutbound}
                                disabled={syncOutboundSaving}
                                title="Pull the outbound's real current state from WMS now, instead of waiting for the next scheduled poll — useful if it was changed directly in the WMS panel, even before the local record has caught up to an 'outbound' stage."
                              >
                                {syncOutboundSaving ? 'Syncing...' : 'Sync Outbound'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                        <tr>
                          <th>Invalid</th>
                          <td>
                            <span className={`badge ${order?.invalidOrder ? 'badge-warning' : 'badge-success'}`}>
                              {order?.invalidOrder ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                        <tr><th>Order Placement Date</th><td>{formatDateTime(order?.orderPlacementDate)}</td></tr>
                        <tr><th>ETA</th><td>{order?.eta || '-'}</td></tr>
                        <tr><th>Gulltrans Order ID</th><td>{order?.gulltransOrderId || '-'}</td></tr>
                        <tr>
                          <th>Tracking URL</th>
                          <td>
                            {getTrackingUrl(order) ? (
                              <a href={getTrackingUrl(order)} target="_blank" rel="noreferrer">
                                Track Parcel
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                        <tr><th>Subtotal</th><td>{amountView(order?.subTotal)}</td></tr>
                        <tr><th>Shipping Cost</th><td>{amountView(order?.shippingCost)}</td></tr>
                        <tr><th>Discount</th><td>{amountView(order?.discount)}</td></tr>
                        <tr><th>Total</th><td>{amountView(order?.total)}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h5 className="h5-heading">Shipping Address</h5>
                  <div className="table-responsive mb-4">
                    <table className="table table-bordered mb-0">
                      <tbody>
                        <tr><th style={{ width: '280px' }}>UUID</th><td>{order?.shippingAddress?.uuid || '-'}</td></tr>
                        <tr><th>Full Name</th><td>{order?.shippingAddress?.fullName || '-'}</td></tr>
                        <tr><th>Phone Number</th><td>{order?.shippingAddress?.phoneNumber || '-'}</td></tr>
                        <tr><th>Street Address</th><td>{order?.shippingAddress?.streetAddress || '-'}</td></tr>
                        <tr><th>Apartment</th><td>{order?.shippingAddress?.apartment || '-'}</td></tr>
                        <tr><th>ZIP Code</th><td>{order?.shippingAddress?.zipCode || '-'}</td></tr>
                        <tr><th>City</th><td>{order?.shippingAddress?.city || '-'}</td></tr>
                        <tr><th>State</th><td>{order?.shippingAddress?.state || '-'}</td></tr>
                        <tr><th>Country</th><td>{order?.shippingAddress?.country || '-'}</td></tr>
                        <tr><th>Default</th><td>{order?.shippingAddress?.isDefault ? 'Yes' : 'No'}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h5 className="h5-heading">Order Items</h5>
                  <div className="table-responsive mb-4">
                    <table className="table table-striped table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>Item UUID</th>
                          <th>Product</th>
                          <th>Image</th>
                          <th>Variant</th>
                          <th>Diagnostics</th>
                          <th>1688</th>
                          <th>Review</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Discounted Price</th>
                          <th>Total</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(order.orderItems || []).filter((item) => !item?.invalidOrderItem).map((item) => {
                          const procurementId = getProcurementId(item?.product);
                          const itemHasSkuMeta = hasSkuMeta(item?.variant);
                          const itemSku = getItemSku(item);

                          return (
                          <tr key={item.uuid}>
                            <td>{item?.uuid || '-'}</td>
                            <td>
                              <div>{item?.product?.titleEn || item?.product?.titleAr || '-'}</div>
                              {item?.product?.uuid ? (
                                <small className="text-muted d-block">{item.product.uuid}</small>
                              ) : null}
                            </td>
                            <td>
                              {item?.product?.featuredThumbnailUrl || item?.product?.featuredImageUrl ? (
                                <img
                                  src={getTransformedImageUrl(item.product.featuredThumbnailUrl || item.product.featuredImageUrl)}
                                  alt={item?.product?.titleEn || 'Product'}
                                  style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                                />
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <div>{item?.variant?.titleEn || item?.variant?.sku || '-'}</div>
                              {item?.variant?.uuid ? (
                                <small className="text-muted d-block">{item.variant.uuid}</small>
                              ) : null}
                            </td>
                            <td style={{ minWidth: '220px' }}>
                              <div>
                                <strong>Procurement ID:</strong>{' '}
                                <span className={procurementId ? 'text-success' : 'text-danger'}>
                                  {procurementId ? 'Present' : 'Missing Procurement ID'}
                                </span>
                              </div>
                              <div>
                                <strong>SKU Meta:</strong>{' '}
                                <span className={itemHasSkuMeta ? 'text-success' : 'text-danger'}>
                                  {itemHasSkuMeta ? 'Present' : 'Missing SKU Meta'}
                                </span>
                              </div>
                            </td>
                            <td>
                              {procurementId ? (
                                <a
                                  href={get1688OfferUrl(procurementId)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Open
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              {item?.product?.uuid ? (
                                <Link
                                  href={`/products/reviews/new?productUuid=${encodeURIComponent(item.product.uuid)}${
                                    order?.customer?.emailAddress
                                      ? `&emailAddress=${encodeURIComponent(order.customer.emailAddress)}`
                                      : ''
                                  }&returnTo=${encodeURIComponent(`/orders/${params?.uuid || ''}`)}`}
                                  className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center text-center"
                                >
                                  Add Review
                                </Link>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>{item?.quantity ?? 0}</td>
                            <td>{amountView(item?.price)}</td>
                            <td>{amountView(item?.discountedPrice)}</td>
                            <td>{amountView(item?.total)}</td>
                            <td style={{ minWidth: '160px' }}>
                              <div className="d-flex flex-column" style={{ gap: '4px' }}>
                                <button
                                  className="btn btn-sm btn-outline-primary row-action-btn"
                                  type="button"
                                  onClick={() => openQtyModal(item)}
                                  disabled={isDispatched}
                                >
                                  Edit Qty
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger row-action-btn"
                                  type="button"
                                  onClick={() => openRemoveModal(item)}
                                  disabled={isDispatched || removingSku === itemSku}
                                >
                                  {removingSku === itemSku ? 'Removing...' : 'Remove'}
                                </button>
                                {/* Replace disabled for now — see admin-order-editing-fe-implementation-notes.md §2c/§4.3
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  type="button"
                                  onClick={() => openReplaceModal(item)}
                                >
                                  Replace
                                </button>
                                */}
                              </div>
                            </td>
                          </tr>
                        )})}
                        {(order.orderItems || []).filter((item) => !item?.invalidOrderItem).length === 0 ? (
                          <tr>
                            <td colSpan={12} className="text-center text-muted">No items found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <h5 className="h5-heading">WMS Orders Details</h5>
                  {Array.isArray(order?.wmsOrders) && order.wmsOrders.length > 0 ? (
                    <div className="mb-4">
                      {order.wmsOrders.map((wmsOrder, index) => {
                        const gulltransResponse = wmsOrder?.gulltransResponse || {};
                        const skus = Array.isArray(gulltransResponse?.skus) ? gulltransResponse.skus : [];
                        const canSetTracking = wmsOrder?.type === 'inbound' && wmsOrder?.status === 'awaiting_tracking';
                        return (
                          <div className="card mb-3" key={`${wmsOrder?.id || 'wms'}-${index}`}>
                            <div className="card-header d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">WMS Order #{index + 1}</h6>
                              {canSetTracking ? (
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  type="button"
                                  onClick={() => openTrackingModal(wmsOrder)}
                                >
                                  Set Tracking
                                </button>
                              ) : null}
                            </div>
                            <div className="card-body">
                              <div className="table-responsive mb-3">
                                <table className="table table-bordered mb-0">
                                  <tbody>
                                    <tr><th style={{ width: '280px' }}>Local ID</th><td>{wmsOrder?.id ?? '-'}</td></tr>
                                    <tr><th>Order No</th><td>{wmsOrder?.orderNo || '-'}</td></tr>
                                    <tr><th>Type</th><td>{prettyWmsType(wmsOrder?.type)}</td></tr>
                                    <tr><th>Status</th><td><span className="badge badge-info">{String(wmsOrder?.status || '-')}</span></td></tr>
                                    <tr><th>WMS Assigned ID</th><td>{wmsOrder?.wmsAssignedId || '-'}</td></tr>
                                    <tr><th>Waybill No</th><td>{wmsOrder?.waybillNo || '-'}</td></tr>
                                    <tr><th>Error Count</th><td>{wmsOrder?.errorCount ?? 0}</td></tr>
                                    <tr><th>Last Error</th><td>{wmsOrder?.lastError || '-'}</td></tr>
                                    <tr><th>Last Polled At</th><td>{formatDateTime(wmsOrder?.lastPolledAt)}</td></tr>
                                    <tr><th>Created At</th><td>{formatDateTime(wmsOrder?.createdAt)}</td></tr>
                                    <tr><th>Updated At</th><td>{formatDateTime(wmsOrder?.updatedAt)}</td></tr>
                                    <tr><th>Gulltrans Order SN</th><td>{gulltransResponse?.order_sn || '-'}</td></tr>
                                    <tr><th>Gulltrans Currency</th><td>{gulltransResponse?.currency || '-'}</td></tr>
                                    <tr><th>Gulltrans Amount</th><td>{gulltransResponse?.amount ?? '-'}</td></tr>
                                    <tr><th>Gulltrans Status Name</th><td>{gulltransResponse?.status_name || '-'}</td></tr>
                                    <tr><th>Warehouse Name</th><td>{gulltransResponse?.warehouse?.warehouse_name || '-'}</td></tr>
                                  </tbody>
                                </table>
                              </div>

                              <h6 className="mb-2">Gulltrans SKUs</h6>
                              <div className="table-responsive">
                                <table className="table table-striped table-bordered mb-0">
                                  <thead>
                                    <tr>
                                      <th>Code</th>
                                      <th>Platform SKU</th>
                                      <th>Name</th>
                                      <th>Qty</th>
                                      <th>Price</th>
                                      <th>Amount</th>
                                      <th>Platform URL</th>
                                      <th>SKU Image</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {skus.map((sku, skuIndex) => (
                                      <tr key={`${sku?.id || 'sku'}-${skuIndex}`}>
                                        <td>{sku?.code || '-'}</td>
                                        <td>{sku?.platform_sku || '-'}</td>
                                        <td>{sku?.name || '-'}</td>
                                        <td>{sku?.quantity ?? '-'}</td>
                                        <td>{sku?.price ?? '-'}</td>
                                        <td>{sku?.amount ?? '-'}</td>
                                        <td>
                                          {sku?.platform_url ? (
                                            <a href={sku.platform_url} target="_blank" rel="noreferrer">
                                              Open
                                            </a>
                                          ) : '-'}
                                        </td>
                                        <td>
                                          {sku?.sku_info?.sku_img ? (
                                            <img
                                              src={getTransformedImageUrl(sku.sku_info.sku_img)}
                                              alt={sku?.name || 'SKU'}
                                              style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                                            />
                                          ) : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                    {skus.length === 0 ? (
                                      <tr>
                                        <td colSpan={8} className="text-center text-muted">No SKU details found.</td>
                                      </tr>
                                    ) : null}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="table-responsive mb-4">
                      <table className="table table-bordered mb-0">
                        <tbody>
                          <tr><th style={{ width: '280px' }}>WMS Orders</th><td className="text-muted">No WMS order details found.</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
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
                  <div className="mb-2"><strong>Order UUID:</strong> {order?.uuid || '-'}</div>
                  <div className="mb-3"><strong>Current Status:</strong> {getOrderStatusLabel(order?.status)}</div>
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

      {showQtyModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Item Quantity</h5>
                  <button type="button" className="close" onClick={() => setShowQtyModal(false)} disabled={qtySaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-2"><strong>SKU:</strong> {getItemSku(qtyItem) || '-'}</div>
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={qtyValue}
                    onChange={(e) => setQtyValue(e.target.value)}
                    disabled={qtySaving}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowQtyModal(false)} disabled={qtySaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onSaveQty} disabled={qtySaving}>
                    {qtySaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showRemoveModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Remove Order Item</h5>
                  <button type="button" className="close" onClick={() => setShowRemoveModal(false)}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-warning mb-0">
                    Remove SKU <strong>{getItemSku(removeItem) || '-'} </strong> from this order? Stock reserved for it
                    is released back to inventory. This can&apos;t be undone from here — the item stays on the order
                    for audit history but is treated as gone everywhere it&apos;s shown.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowRemoveModal(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onConfirmRemove}>
                    Remove Item
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showReplaceModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Replace Order Item</h5>
                  <button type="button" className="close" onClick={() => setShowReplaceModal(false)} disabled={replaceSaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3"><strong>Replacing SKU:</strong> {getItemSku(replaceItem) || '-'}</div>
                  {replaceError ? <div className="alert alert-danger">{replaceError}</div> : null}
                  {replaceErrorDetails ? <div className="alert alert-warning">{replaceErrorDetails}</div> : null}
                  <VariantPicker
                    apiFetch={apiFetch}
                    selectedVariant={replaceVariant}
                    onSelectVariant={setReplaceVariant}
                    disabled={replaceSaving}
                  />
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control mb-3"
                    value={replaceQuantity}
                    onChange={(e) => setReplaceQuantity(e.target.value)}
                    disabled={replaceSaving}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowReplaceModal(false)} disabled={replaceSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onSubmitReplace} disabled={replaceSaving}>
                    {replaceSaving ? 'Replacing...' : 'Replace Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showAddItemModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Add Order Item</h5>
                  <button type="button" className="close" onClick={() => setShowAddItemModal(false)} disabled={addItemSaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  {addItemError ? <div className="alert alert-danger">{addItemError}</div> : null}
                  {addItemErrorDetails ? <div className="alert alert-warning">{addItemErrorDetails}</div> : null}
                  <VariantPicker
                    apiFetch={apiFetch}
                    selectedVariant={addItemVariant}
                    onSelectVariant={setAddItemVariant}
                    disabled={addItemSaving}
                  />
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control mb-3"
                    value={addItemQuantity}
                    onChange={(e) => setAddItemQuantity(e.target.value)}
                    disabled={addItemSaving}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowAddItemModal(false)} disabled={addItemSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onSubmitAddItem} disabled={addItemSaving}>
                    {addItemSaving ? 'Adding...' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

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
                  {trackingModalError ? <div className="alert alert-danger">{trackingModalError}</div> : null}
                  <div className="mb-3"><strong>Order No:</strong> {trackingWmsOrder?.orderNo || '-'}</div>
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

      <style jsx>{`
        /* The vendor .btn-outline-*:disabled rule has no :hover override, so hovering a
           disabled row-action button can still trigger its active-hover colors (unreadable). */
        .row-action-btn:disabled {
          cursor: not-allowed;
        }
        .btn-outline-primary.row-action-btn:disabled:hover {
          color: #fe634e;
          background-color: transparent;
          border-color: #fe634e;
        }
        .btn-outline-danger.row-action-btn:disabled:hover {
          color: #ff4847;
          background-color: transparent;
          border-color: #ff4847;
        }
      `}</style>
    </div>
  );
}
