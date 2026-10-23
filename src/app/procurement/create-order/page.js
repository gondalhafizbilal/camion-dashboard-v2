'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function toAddress(address = {}) {
  return {
    address: address?.streetAddress || address?.address || '',
    province: address?.state || '',
    city: address?.city || '',
    company: '',
    district: address?.district || '',
    street: address?.streetAddress || address?.street || '',
    postcode: address?.zipCode || '',
    phone: address?.phoneNumber || '',
    receiver_name: address?.fullName || '',
    email: '',
    country_name: address?.country || '',
    country: {
      country_code: address?.countryCode || '',
      name: address?.country || '',
    },
  };
}

function buildOrdersFromOrder(order) {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
  return items
    .map((item) => {
      const variant = item?.variant || {};
      const product = item?.product || {};
      const skuMeta = variant?.skuMeta || {};
      const platformSku = String(variant?.sku || '').trim();
      if (!platformSku) return null;
      const quantity = String(item?.quantity || 1);
      const price = String(item?.price?.amount ?? variant?.price?.amount ?? 0);
      const goodsAmount = String((Number(price) || 0) * (Number(quantity) || 0));

      return {
        shop_id: skuMeta?.shop_id || product?.shopId || '',
        shop_name: skuMeta?.shop_name || product?.shopName || '',
        platform: '1688',
        platform_url: product?.procurementId ? `https://detail.1688.com/offer/${product.procurementId}.html` : '',
        name: product?.titleEn || product?.title || variant?.titleEn || variant?.title || platformSku,
        title_cn: '',
        goods_amount: goodsAmount,
        freight_fee: '0',
        remark: '',
        skus: [
          {
            price,
            platform_sku: platformSku,
            quantity,
            freight_fee: '0',
            sku_info: skuMeta || {},
          },
        ],
      };
    })
    .filter(Boolean);
}

const ORDER_CURRENCY = 'qar';

export default function ProcurementCreateOrderPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingOrderUUID, setCreatingOrderUUID] = useState('');
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
        const backendError = payload?.errors?.error || payload?.message || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }
      return payload;
    },
    [token]
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [ordersData, warehousesData] = await Promise.all([
        apiFetch(`/api/orders?pageNumber=1&itemsPerPage=50&status=confirmed&currency=${ORDER_CURRENCY}`, { method: 'GET' }),
        apiFetch('/api/warehouses?pageNumber=1&itemsPerPage=100', { method: 'GET' }),
      ]);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      const wh = Array.isArray(warehousesData) ? warehousesData : [];
      setWarehouses(wh);
      if (wh[0]?.uuid) setSelectedWarehouse(wh[0].uuid);
    } catch (err) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onCreateFromOrder = async (orderUUID) => {
    if (!orderUUID) return;
    if (!selectedWarehouse) {
      setError('Please select warehouse.');
      return;
    }
    setCreatingOrderUUID(orderUUID);
    setError('');
    setMessage('');
    try {
      const order = await apiFetch(`/api/orders/${orderUUID}?currency=${ORDER_CURRENCY}`, { method: 'GET' });
      const mappedOrders = buildOrdersFromOrder(order);
      if (!mappedOrders.length) throw new Error('No valid SKU data found on order items.');
      const payload = {
        orders: mappedOrders,
        address: toAddress(order?.shippingAddress || {}),
      };
      await apiFetch('/api/procurement/order/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage(`Procurement order created from order ${orderUUID}.`);
    } catch (err) {
      setError(err.message || 'Failed to create procurement order.');
    } finally {
      setCreatingOrderUUID('');
    }
  };

  if (!isValid) return <div className="screen-center">Loading procurement...</div>;

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />
      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Procurement - Create Order From Orders</h4>
              <button className="btn btn-light btn-sm" type="button" onClick={loadData} disabled={loading}>
                Refresh
              </button>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {message ? <div className="alert alert-success">{message}</div> : null}

              <div className="row mb-3">
                <div className="col-md-4">
                  <label className="form-label">Warehouse</label>
                  <select className="form-control" value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
                    {warehouses.map((w) => (
                      <option key={w.uuid} value={w.uuid}>
                        {w.name || w.uuid}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">Customer shipping address from selected order is used in request.</small>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Order UUID</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Address</th>
                      <th>Items</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.uuid}>
                        <td>{order.uuid}</td>
                        <td>{order.status}</td>
                        <td>{order?.shippingAddress?.fullName || order?.customer?.fullName || '-'}</td>
                        <td>
                          {order?.shippingAddress
                            ? `${order.shippingAddress.streetAddress || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.country || ''}`
                            : '-'}
                        </td>
                        <td>{Array.isArray(order?.orderItems) ? order.orderItems.length : 0}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            onClick={() => onCreateFromOrder(order.uuid)}
                            disabled={creatingOrderUUID === order.uuid}
                          >
                            {creatingOrderUUID === order.uuid ? 'Creating...' : 'Create Order'}
                          </button>
                        </td>
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
