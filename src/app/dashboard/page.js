'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { formatDateTime } from '@/lib/dateTime';
import { getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.name ||
    user?.emailAddress ||
    'User'
  );
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function flattenCategories(categories, parentName = null) {
  if (!Array.isArray(categories)) return [];

  const rows = [];
  for (const category of categories) {
    const currentName = category?.nameEn || category?.name || '-';
    rows.push({ ...category, parentName });
    if (Array.isArray(category?.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, currentName));
    }
  }

  return rows;
}

const ORDER_CURRENCY = 'qar';

function formatStatus(status) {
  if (!status) return '-';
  const value = String(status).toUpperCase();
  if (value === 'ACTIVE') return 'Active';
  if (value === 'DRAFT') return 'Draft';
  if (value === 'ARCHIVED') return 'Archived';
  return value;
}

function mapOrder(order) {
  const firstItem = Array.isArray(order?.orderItems) ? order.orderItems[0] : null;
  const firstProduct = firstItem?.product;
  const customer = order?.customer?.fullName || order?.customer?.name || '-';

  return {
    uuid: String(order?.uuid || ''),
    customer,
    status: String(order?.status || '').toLowerCase(),
    total: Number(order?.total?.amount || 0),
    currencyCode: order?.total?.currencyCode || 'USD',
    createdAt: order?.createdAt || null,
    itemCount: Array.isArray(order?.orderItems) ? order.orderItems.length : 0,
    itemTitle: firstProduct?.titleEn || firstProduct?.title || '-',
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [countsData, setCountsData] = useState({});
  const [dashboardData, setDashboardData] = useState({
    products: [],
    categories: [],
    warehouses: [],
    orders: [],
  });

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
    async (path) => {
      const response = await fetch(path, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.errors?.error || 'Request failed');
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !isValid) return;
    let active = true;

    const load = async () => {
      setStatsLoading(true);
      setStatsError('');

      try {
        const [productsRes, categoriesRes, warehousesRes, ordersRes, countsRes] = await Promise.all([
          apiFetch('/api/products?itemsPerPage=50&pageNumber=1&sort=desc'),
          apiFetch('/api/categories?itemsPerPage=100&pageNumber=1'),
          apiFetch('/api/warehouses?itemsPerPage=50&pageNumber=1'),
          apiFetch(`/api/orders?itemsPerPage=20&pageNumber=1&sort=createdAt:desc&currency=${ORDER_CURRENCY}`),
          apiFetch('/api/data/counts'),
        ]);

        if (!active) return;

        setDashboardData({
          products: toList(productsRes),
          categories: toList(categoriesRes),
          warehouses: toList(warehousesRes),
          orders: toList(ordersRes).map(mapOrder),
        });
        setCountsData(
          countsRes && typeof countsRes === 'object' && !Array.isArray(countsRes)
            ? countsRes
            : {}
        );
      } catch (err) {
        if (active) {
          setStatsError(err.message || 'Failed to load dashboard data.');
        }
      } finally {
        if (active) setStatsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [apiFetch, isValid, token]);

  const flattenedCategories = useMemo(
    () => flattenCategories(dashboardData.categories),
    [dashboardData.categories]
  );

  const inventoryStats = useMemo(() => {
    const productStatusCounts = dashboardData.products.reduce(
      (acc, item) => {
        const key = String(item?.status || 'DRAFT').toUpperCase();
        if (!acc[key]) acc[key] = 0;
        acc[key] += 1;
        return acc;
      },
      { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 }
    );

    const totalOptions = dashboardData.products.reduce(
      (sum, item) => sum + (Array.isArray(item?.options) ? item.options.length : 0),
      0
    );

    const totalVariants = dashboardData.products.reduce(
      (sum, item) => sum + (Array.isArray(item?.variants) ? item.variants.length : 0),
      0
    );

    const activeWarehouses = dashboardData.warehouses.filter((item) => !!item?.isActive).length;
    const childCategories = Math.max(flattenedCategories.length - dashboardData.categories.length, 0);

    return {
      totalProducts: dashboardData.products.length,
      totalCategories: flattenedCategories.length,
      rootCategories: dashboardData.categories.length,
      childCategories,
      totalWarehouses: dashboardData.warehouses.length,
      activeWarehouses,
      totalOptions,
      totalVariants,
      activeProducts: productStatusCounts.ACTIVE || 0,
      draftProducts: productStatusCounts.DRAFT || 0,
      archivedProducts: productStatusCounts.ARCHIVED || 0,
    };
  }, [dashboardData.categories, dashboardData.products, dashboardData.warehouses, flattenedCategories.length]);

  const orderStats = useMemo(() => {
    const statusCounts = dashboardData.orders.reduce(
      (acc, item) => {
        const key = String(item?.status || 'pending').toLowerCase();
        if (!acc[key]) acc[key] = 0;
        acc[key] += 1;
        return acc;
      },
      {}
    );

    return {
      totalOrders: dashboardData.orders.length,
      deliveredOrders: statusCounts.delivered || 0,
      pendingOrders: statusCounts.pending || 0,
      processingOrders: statusCounts.processing || 0,
    };
  }, [dashboardData.orders]);

  const mergedTopCounts = useMemo(
    () => ({
      products: Number(countsData?.products ?? inventoryStats.totalProducts ?? 0),
      categories: Number(countsData?.categories ?? inventoryStats.totalCategories ?? 0),
      orders: Number(countsData?.orders ?? orderStats.totalOrders ?? 0),
      warehouses: Number(inventoryStats.totalWarehouses ?? 0),
      stories: Number(countsData?.stories ?? 0),
      banners: Number(countsData?.banners ?? 0),
    }),
    [countsData, inventoryStats.totalCategories, inventoryStats.totalProducts, inventoryStats.totalWarehouses, orderStats.totalOrders]
  );

  const topStatCards = useMemo(
    () => [
      {
        key: 'products',
        label: 'Products',
        value: mergedTopCounts.products,
        iconClass: 'flaticon-381-box',
        iconBg: '#e8f1ff',
        iconColor: '#2f6fed',
        chipClass: 'badge-success',
        chipText: `Active ${inventoryStats.activeProducts}`,
      },
      {
        key: 'categories',
        label: 'Categories',
        value: mergedTopCounts.categories,
        iconClass: 'flaticon-381-list',
        iconBg: '#e8f9f1',
        iconColor: '#1f9d64',
        chipClass: 'badge-info',
        chipText: `Root ${inventoryStats.rootCategories}`,
      },
      {
        key: 'orders',
        label: 'Orders',
        value: mergedTopCounts.orders,
        iconClass: 'flaticon-381-file',
        iconBg: '#fff2e9',
        iconColor: '#e76f45',
        chipClass: 'badge-warning',
        chipText: `Pending ${orderStats.pendingOrders}`,
      },
      {
        key: 'warehouses',
        label: 'Warehouses',
        value: mergedTopCounts.warehouses,
        iconClass: 'flaticon-381-box-2',
        iconBg: '#f0ecff',
        iconColor: '#7551d2',
        chipClass: 'badge-primary',
        chipText: `Active ${inventoryStats.activeWarehouses}`,
      },
      {
        key: 'stories',
        label: 'Stories',
        value: mergedTopCounts.stories,
        iconClass: 'flaticon-381-notepad',
        iconBg: '#e9f8ff',
        iconColor: '#0aa2d5',
        chipClass: 'badge-secondary',
        chipText: 'Total',
      },
      {
        key: 'banners',
        label: 'Banners',
        value: mergedTopCounts.banners,
        iconClass: 'flaticon-381-photo-camera',
        iconBg: '#ffeef6',
        iconColor: '#d14a8b',
        chipClass: 'badge-danger',
        chipText: 'Total',
      },
    ],
    [
      inventoryStats.activeProducts,
      inventoryStats.activeWarehouses,
      inventoryStats.rootCategories,
      mergedTopCounts.banners,
      mergedTopCounts.categories,
      mergedTopCounts.orders,
      mergedTopCounts.products,
      mergedTopCounts.stories,
      mergedTopCounts.warehouses,
      orderStats.pendingOrders,
    ]
  );

  if (!isValid) {
    return <div className="screen-center">Loading dashboard...</div>;
  }

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          {statsError ? <div className="alert alert-danger">{statsError}</div> : null}

          <div className="row">
            {topStatCards.map((card) => (
              <div key={card.key} className="col-xl-4 col-md-6">
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex align-items-center mb-2">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-3"
                        style={{ width: '44px', height: '44px', backgroundColor: card.iconBg }}
                      >
                        <i className={card.iconClass} style={{ color: card.iconColor, fontSize: '18px' }} />
                      </div>
                      <p className="text-muted mb-0 pl-2" style={{ fontSize: '20' }}>{card.label}</p>
                    </div>
                    <h2 className="text-black mb-3" style={{ fontSize: '40', fontWeight: 700 }}>
                      {statsLoading ? '-' : card.value}
                    </h2>
                    <span className={`badge light ${card.chipClass}`} style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '18px' }}>
                      {card.chipText}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row">
            <div className="col-xl-8">
              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Recent Products</h4>
                  <Link href="/products" className="btn btn-outline-primary btn-sm">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {statsLoading ? <p className="mb-0">Loading products...</p> : null}
                  {!statsLoading && dashboardData.products.length === 0 ? (
                    <p className="mb-0">No products found.</p>
                  ) : null}
                  {!statsLoading && dashboardData.products.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Title</th>
                            <th>Slug</th>
                            <th>Status</th>
                            <th>Variants</th>
                            <th>Options</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.products.slice(0, 8).map((product) => (
                            <tr key={product.uuid}>
                              <td>
                                {product?.featuredThumbnailUrl || product?.featuredImageUrl ? (
                                  <img
                                    src={getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl)}
                                    alt={product?.titleEn || product?.title || 'Product'}
                                    style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }}
                                  />
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>{product.titleEn || product.title || '-'}</td>
                              <td>{product.slug || '-'}</td>
                              <td>{formatStatus(product.status)}</td>
                              <td>{Array.isArray(product.variants) ? product.variants.length : 0}</td>
                              <td>{Array.isArray(product.options) ? product.options.length : 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-xl-4">
              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Product Status</h4>
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between border-bottom py-2">
                    <span>Active</span>
                    <strong>{statsLoading ? '-' : inventoryStats.activeProducts}</strong>
                  </div>
                  <div className="d-flex justify-content-between border-bottom py-2">
                    <span>Draft</span>
                    <strong>{statsLoading ? '-' : inventoryStats.draftProducts}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-2">
                    <span>Archived</span>
                    <strong>{statsLoading ? '-' : inventoryStats.archivedProducts}</strong>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Warehouses</h4>
                  <Link href="/warehouses" className="btn btn-outline-primary btn-sm">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {statsLoading ? <p className="mb-0">Loading warehouses...</p> : null}
                  {!statsLoading && dashboardData.warehouses.length === 0 ? (
                    <p className="mb-0">No warehouses found.</p>
                  ) : null}
                  {!statsLoading && dashboardData.warehouses.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-sm table-borderless mb-0">
                        <tbody>
                          {dashboardData.warehouses.slice(0, 6).map((warehouse) => (
                            <tr key={warehouse.uuid}>
                              <td>
                                <strong>{warehouse.name || '-'}</strong>
                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                  {warehouse.code || '-'} | {warehouse.city || '-'}
                                </div>
                              </td>
                              <td className="text-right">
                                <span className={`badge badge-sm ${warehouse.isActive ? 'badge-success' : 'badge-secondary'}`}>
                                  {warehouse.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-xl-12">
              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Categories Overview</h4>
                  <Link href="/categories" className="btn btn-outline-primary btn-sm">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {statsLoading ? <p className="mb-0">Loading categories...</p> : null}
                  {!statsLoading && flattenedCategories.length === 0 ? (
                    <p className="mb-0">No categories found.</p>
                  ) : null}
                  {!statsLoading && flattenedCategories.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped mb-0">
                        <thead>
                          <tr>
                            <th>Name (EN)</th>
                            <th>Slug</th>
                            <th>Parent</th>
                            <th>Pricing Factor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {flattenedCategories.slice(0, 12).map((category) => (
                            <tr key={category.uuid}>
                              <td>{category.nameEn || category.name || '-'}</td>
                              <td>{category.slug || '-'}</td>
                              <td>{category.parentName || '-'}</td>
                              <td>{category.pricingFactor ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-xl-8">
              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Latest Orders</h4>
                  <Link href="/orders" className="btn btn-outline-primary btn-sm">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {statsLoading ? <p className="mb-0">Loading orders...</p> : null}
                  {!statsLoading && dashboardData.orders.length === 0 ? <p className="mb-0">No orders found.</p> : null}
                  {!statsLoading && dashboardData.orders.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped mb-0">
                        <thead>
                          <tr>
                            <th>UUID</th>
                            <th>Status</th>
                            <th>Total</th>
                            <th>Items</th>
                            <th>Customer</th>
                            <th>Created At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardData.orders.slice(0, 8).map((order) => (
                            <tr key={order.uuid}>
                              <td>{order.uuid || '-'}</td>
                              <td>{order.status || '-'}</td>
                              <td>
                                {order.currencyCode} {Number(order.total || 0).toFixed(2)}
                              </td>
                              <td>{order.itemCount}</td>
                              <td>{order.customer || '-'}</td>
                              <td>{formatDateTime(order.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="col-xl-4">
              <div className="card">
                <div className="card-header border-0 pb-0 d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Order Status</h4>
                </div>
                <div className="card-body">
                  <div className="d-flex justify-content-between border-bottom py-2">
                    <span>Delivered</span>
                    <strong>{statsLoading ? '-' : orderStats.deliveredOrders}</strong>
                  </div>
                  <div className="d-flex justify-content-between border-bottom py-2">
                    <span>Pending</span>
                    <strong>{statsLoading ? '-' : orderStats.pendingOrders}</strong>
                  </div>
                  <div className="d-flex justify-content-between py-2">
                    <span>Processing</span>
                    <strong>{statsLoading ? '-' : orderStats.processingOrders}</strong>
                  </div>
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
