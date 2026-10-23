'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function flattenCategories(categories, depth = 0) {
  if (!Array.isArray(categories)) return [];

  const rows = [];
  categories.forEach((category) => {
    rows.push({ ...category, depth });
    if (Array.isArray(category.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, depth + 1));
    }
  });

  return rows;
}

function get1688OfferUrl(procurementId) {
  const value = String(procurementId || '').trim();
  return value ? `https://detail.1688.com/offer/${encodeURIComponent(value)}.html` : '';
}

function ProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuToggled, setMenuToggled] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedProductUuids, setSelectedProductUuids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [resyncLoading, setResyncLoading] = useState(false);
  const [categoryResyncScope, setCategoryResyncScope] = useState('all');
  const [categoryResyncSubmitting, setCategoryResyncSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [statusUpdatingUUID, setStatusUpdatingUUID] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalData, setStatusModalData] = useState({
    uuid: '',
    title: '',
    status: 'draft',
  });
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);
  const [urgencyModalData, setUrgencyModalData] = useState({
    uuid: '',
    title: '',
    enabled: false,
    stockCount: '',
    resolvedStockCount: '',
  });
  const [urgencySavingUUID, setUrgencySavingUUID] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [filters, setFilters] = useState({
    query: '',
    categorySlug: '',
    sort: 'desc',
    itemsPerPage: 20,
    pageNumber: 1,
  });
  const [manualPageInput, setManualPageInput] = useState('1');

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

  useEffect(() => {
    const categorySlug = String(searchParams?.get('categorySlug') || '').trim();
    if (!categorySlug) return;
    setFilters((prev) => {
      if (prev.categorySlug === categorySlug) return prev;
      return { ...prev, categorySlug, pageNumber: 1 };
    });
  }, [searchParams]);

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
        const backendError = payload?.errors?.error || payload?.errors?.slug || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadProducts = useCallback(
    async (nextFilters = filters) => {
      if (!token) return;
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('pageNumber', String(nextFilters.pageNumber));
        params.set('itemsPerPage', String(nextFilters.itemsPerPage));
        if (nextFilters.sort) {
          params.set('sort', nextFilters.sort);
        }
        const filtersPayload = {};
        if (nextFilters.query?.trim()) {
          filtersPayload.query = nextFilters.query.trim();
        }
        if (nextFilters.categorySlug) {
          filtersPayload.slug = nextFilters.categorySlug;
        }
        if (Object.keys(filtersPayload).length > 0) {
          params.set('filters', JSON.stringify(filtersPayload));
        }

        const data = await apiFetch(`/api/products?${params.toString()}`, { method: 'GET' });
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load products.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, filters, token]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!token) return;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await apiFetch('/api/categories?itemsPerPage=100&pageNumber=1', { method: 'GET' });
        setCategoryOptions(flattenCategories(Array.isArray(data) ? data : []));
      } catch (err) {
        setError(err.message || 'Failed to load categories.');
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [apiFetch, token]);

  const onDeleteProduct = async () => {
    if (!selectedProduct?.uuid) return;

    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/products/${selectedProduct.uuid}`, { method: 'DELETE' });
      setMessage('Product deleted.');
      setShowDeleteModal(false);
      setSelectedProduct(null);
      await loadProducts(filters);
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onApplyFilters = async (event) => {
    event.preventDefault();
    const nextFilters = { ...filters, pageNumber: 1 };
    setFilters(nextFilters);
    await loadProducts(nextFilters);
  };

  const onPageChange = async (nextPageNumber) => {
    const nextFilters = { ...filters, pageNumber: nextPageNumber };
    setFilters(nextFilters);
    setManualPageInput(String(nextPageNumber));
    await loadProducts(nextFilters);
  };

  const onManualPageSubmit = async () => {
    const parsed = Number.parseInt(String(manualPageInput || '').trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError('Enter a valid page number (1 or greater).');
      return;
    }
    await onPageChange(parsed);
  };

  const onUpdateStatus = async (productUUID, status) => {
    if (!productUUID || !status) return;
    setStatusUpdatingUUID(productUUID);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${productUUID}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: String(status).toLowerCase() }),
      });
      setProducts((prev) =>
        prev.map((product) => (product.uuid === productUUID ? { ...product, status: String(status).toUpperCase() } : product))
      );
      setMessage('Product status updated.');
    } catch (err) {
      setError(err.message || 'Failed to update product status.');
    } finally {
      setStatusUpdatingUUID('');
    }
  };

  const openUrgencyModal = (product) => {
    setUrgencyModalData({
      uuid: product?.uuid || '',
      title: product?.titleEn || product?.title || product?.slug || '',
      enabled: Boolean(product?.urgencyEnabled),
      stockCount:
        product?.urgencyStockCount !== null && product?.urgencyStockCount !== undefined
          ? String(product.urgencyStockCount)
          : product?.stockCount !== null && product?.stockCount !== undefined
            ? String(product.stockCount)
            : '',
      resolvedStockCount:
        product?.stockCount !== null && product?.stockCount !== undefined ? String(product.stockCount) : '-',
    });
    setShowUrgencyModal(true);
  };

  const onUpdateUrgency = async (productUUID, enabled, stockCount) => {
    if (!productUUID) return;
    if (enabled && String(stockCount || '').trim() === '') {
      setError('Enter a stock count for urgency.');
      return;
    }

    setUrgencySavingUUID(productUUID);
    setError('');
    setMessage('');
    try {
      const payload = {
        enabled: Boolean(enabled),
      };
      if (enabled) {
        payload.stockCount = Number(stockCount);
      }

      await apiFetch(`/api/products/${productUUID}/urgency`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setMessage('Product urgency updated.');
      await loadProducts(filters);
    } catch (err) {
      setError(err.message || 'Failed to update product urgency.');
    } finally {
      setUrgencySavingUUID('');
    }
  };

  const onToggleProductSelection = useCallback((productUUID) => {
    if (!productUUID) return;
    setSelectedProductUuids((prev) => {
      if (prev.includes(productUUID)) {
        return prev.filter((uuid) => uuid !== productUUID);
      }
      if (prev.length >= 50) {
        return prev;
      }
      return [...prev, productUUID];
    });
  }, []);

  const onToggleSelectCurrentPage = useCallback(
    (checked) => {
      const pageUuids = products.map((product) => product?.uuid).filter(Boolean);
      if (!checked) {
        setSelectedProductUuids((prev) => prev.filter((uuid) => !pageUuids.includes(uuid)));
        return;
      }
      setSelectedProductUuids((prev) => {
        const merged = [...prev];
        for (const uuid of pageUuids) {
          if (merged.includes(uuid)) continue;
          if (merged.length >= 50) break;
          merged.push(uuid);
        }
        return merged;
      });
    },
    [products]
  );

  const clearSelection = useCallback(() => {
    setSelectedProductUuids([]);
  }, []);


  const onBulkResyncVariants = useCallback(async () => {
    if (!selectedProductUuids.length) {
      setError('Select at least one product.');
      return;
    }
    setResyncLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch('/api/procurement/resync-variants', {
        method: 'POST',
        body: JSON.stringify({
          productUuids: selectedProductUuids.slice(0, 50),
        }),
      });
      setMessage(
        `Resync completed. Matched: ${response?.variantsMatched ?? 0}, Updated: ${response?.variantsUpdated ?? 0}, Missing in source: ${response?.variantsMissingInSource ?? 0}.`
      );
    } catch (err) {
      setError(err.message || 'Failed to resync variants.');
    } finally {
      setResyncLoading(false);
    }
  }, [apiFetch, selectedProductUuids]);

  const onQueueCategoryResync = useCallback(async () => {
    if (categoryResyncSubmitting) return;
    setError('');
    setMessage('');

    if (categoryResyncScope === 'selected' && selectedProductUuids.length === 0) {
      setError('Select at least one product for Selected Products scope.');
      return;
    }

    const payload =
      categoryResyncScope === 'selected'
        ? { scope: 'selected', productUuids: selectedProductUuids.slice(0, 50) }
        : { scope: 'all' };

    setCategoryResyncSubmitting(true);
    try {
      const response = await apiFetch('/api/products/resync-categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const jobId = String(response?.jobId || response?.job?.jobId || response?.job?.id || '').trim();
      setMessage(jobId ? `Category resync queued. Job ID: ${jobId}` : 'Category resync queued.');
    } catch (err) {
      setError(err.message || 'Failed to queue category resync.');
    } finally {
      setCategoryResyncSubmitting(false);
    }
  }, [apiFetch, categoryResyncScope, categoryResyncSubmitting, selectedProductUuids]);


  const currentPageSelectedCount = useMemo(() => {
    const pageUuids = products.map((product) => product?.uuid).filter(Boolean);
    return pageUuids.filter((uuid) => selectedProductUuids.includes(uuid)).length;
  }, [products, selectedProductUuids]);

  const selectableCurrentPageCount = useMemo(
    () => products.map((product) => product?.uuid).filter(Boolean).length,
    [products]
  );

  const allCurrentPageSelected =
    selectableCurrentPageCount > 0 && currentPageSelectedCount === selectableCurrentPageCount;

  const openStatusModal = (product) => {
    setStatusModalData({
      uuid: product?.uuid || '',
      title: product?.titleEn || product?.title || product?.slug || '',
      status: String(product?.status || 'draft').toLowerCase(),
    });
    setShowStatusModal(true);
  };

  if (!isValid) {
    return <div className="screen-center">Loading products...</div>;
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
                  <h4 className="card-title mb-0">Product Management</h4>
                  <div className="d-flex" style={{ gap: "8px" }}>
                  {/* <Link href="/products/resync-all" className="btn btn-outline-dark btn-sm">
                    Sync All
                  </Link> */}
                  <Link href="/products/create" className="btn btn-primary btn-sm">
                    Create Product
                  </Link>
                </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <form onSubmit={onApplyFilters} className="mb-3">
                    <div className="row">
                      <div className="col-md-4 mb-2">
                        <label className="form-label">Search</label>
                        <input
                          className="form-control"
                          placeholder="Search by title/description"
                          value={filters.query}
                          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-3 mb-2">
                        <label className="form-label">Sort</label>
                        <select
                          className="form-control"
                          value={filters.sort}
                          onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                        >
                          <option value="desc">Newest</option>
                          <option value="asc">Oldest</option>
                          <option value="best-match">Best Match</option>
                          <option value="price:low-to-high">Price: Low to High</option>
                          <option value="price:high-to-low">Price: High to Low</option>
                        </select>
                      </div>
                      <div className="col-md-5 mb-2">
                        <label className="form-label">Category Filter (Slug)</label>
                        <select
                          className="form-control"
                          value={filters.categorySlug}
                          disabled={loadingCategories}
                          onChange={(e) => setFilters((prev) => ({ ...prev, categorySlug: e.target.value }))}
                        >
                          <option value="">All categories</option>
                          {categoryOptions.map((category) => (
                            <option key={category.uuid} value={category.slug}>
                              {`${'— '.repeat(category.depth)}${category.nameEn || category.name || category.slug}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3 mb-2">
                        <label className="form-label">Items Per Page</label>
                        <select
                          className="form-control"
                          value={filters.itemsPerPage}
                          onChange={(e) => setFilters((prev) => ({ ...prev, itemsPerPage: Number(e.target.value) }))}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                      <div className="col-md-12 mb-2 d-flex align-items-end justify-content-end" style={{ gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" type="submit">
                          Apply
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          type="button"
                          onClick={async () => {
                            const reset = { query: '', categorySlug: '', sort: 'desc', itemsPerPage: 20, pageNumber: 1 };
                            setFilters(reset);
                            await loadProducts(reset);
                          }}
                        >
                          Reset
                        </button>
                        <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => loadProducts(filters)}>
                          Refresh
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="d-flex flex-wrap align-items-center justify-content-between mb-3" style={{ gap: '8px' }}>
                    <small className="text-muted">
                      Selected: {selectedProductUuids.length}/50
                    </small>
                    <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                      <select
                        className="form-control form-control-sm"
                        style={{ width: '180px' }}
                        value={categoryResyncScope}
                        onChange={(e) => setCategoryResyncScope(e.target.value)}
                        disabled={categoryResyncSubmitting}
                      >
                        <option value="all">Category Resync: All</option>
                        <option value="selected">Category Resync: Selected</option>
                      </select>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        type="button"
                        onClick={onQueueCategoryResync}
                        disabled={categoryResyncSubmitting}
                      >
                        {categoryResyncSubmitting ? 'Queueing...' : 'Queue Category Resync'}
                      </button>
                      <Link href="/products/resync-categories" className="btn btn-outline-dark btn-sm">
                        View Resync Status
                      </Link>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        onClick={clearSelection}
                        disabled={selectedProductUuids.length === 0 || resyncLoading}
                      >
                        Clear Selection
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        onClick={onBulkResyncVariants}
                        disabled={selectedProductUuids.length === 0 || resyncLoading}
                      >
                        {resyncLoading ? 'Resyncing...' : `Resync Variants (${selectedProductUuids.length})`}
                      </button>
                    </div>
                  </div>


                  {loading ? <p className="mb-0">Loading products...</p> : null}
                  {!loading && products.length === 0 ? <p className="mb-0">No products found.</p> : null}

                  {!loading && products.length > 0 ? (
                    <>
                      <div className="table-responsive">
                        <table className="table table-striped" style={{ fontSize: '12px' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '44px' }}>
                                <input
                                  type="checkbox"
                                  checked={allCurrentPageSelected}
                                  onChange={(e) => onToggleSelectCurrentPage(e.target.checked)}
                                  disabled={selectableCurrentPageCount === 0 || resyncLoading}
                                  title="Select all on this page"
                                />
                              </th>
                              <th>Featured Image</th>
                              <th>Title</th>
                              <th>Slug</th>
                              <th>Status</th>
                              <th style={{ minWidth: '220px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product) => (
                              <tr key={product.uuid}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedProductUuids.includes(product.uuid)}
                                    onChange={() => onToggleProductSelection(product.uuid)}
                                    disabled={!selectedProductUuids.includes(product.uuid) && selectedProductUuids.length >= 50}
                                    title={
                                      !selectedProductUuids.includes(product.uuid) && selectedProductUuids.length >= 50
                                        ? 'Maximum 50 products can be selected'
                                        : 'Select product'
                                    }
                                  />
                                </td>
                                <td>
                                  {product.featuredImageUrl || product.featuredThumbnailUrl ? (
                                    <img
                                      src={getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl)}
                                      alt={product.titleEn || product.title || 'Product'}
                                      loading="lazy"
                                      decoding="async"
                                      style={{
                                        width: '52px',
                                        height: '52px',
                                        objectFit: 'cover',
                                        borderRadius: '8px',
                                        border: '1px solid #eee',
                                        background: '#f6f6f6',
                                      }}
                                    />
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>{product.titleEn || product.title || '-'}</td>
                                <td>{product.slug || '-'}</td>
                                <td>{product.status || '-'}</td>
                                <td>
                                  <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                                    <Link
                                      href={`/products/reviews?productUuid=${encodeURIComponent(product.uuid)}`}
                                      className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center text-center"
                                    >
                                      Read Reviews
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-warning"
                                      type="button"
                                      disabled={statusUpdatingUUID === product.uuid}
                                      onClick={() => openStatusModal(product)}
                                    >
                                      Update Status
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      type="button"
                                      onClick={() => openUrgencyModal(product)}
                                    >
                                      Urgency
                                    </button>
                                    <Link
                                      href={`/products/${product.uuid}`}
                                      className="btn btn-sm btn-outline-dark d-inline-flex align-items-center justify-content-center text-center"
                                    >
                                      View
                                    </Link>
                                    {product.procurementId || product.procurement_id ? (
                                      <a
                                        href={get1688OfferUrl(product.procurementId || product.procurement_id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-sm btn-outline-secondary d-none"
                                      >
                                        View On 1688
                                      </a>
                                    ) : null}
                                    <Link
                                      href={`/products/${product.uuid}/edit`}
                                      className="btn btn-sm btn-info d-inline-flex align-items-center justify-content-center text-center"
                                    >
                                      Edit
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => {
                                        setSelectedProduct(product);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="d-flex justify-content-end align-items-center flex-wrap mt-3" style={{ gap: '8px' }}>
                        <small className="text-muted mr-1">Page {filters.pageNumber}</small>
                        <button
                          className="btn btn-light btn-sm"
                          type="button"
                          disabled={filters.pageNumber <= 1 || loading}
                          onClick={() => onPageChange(filters.pageNumber - 1)}
                        >
                          Previous
                        </button>
                        <button
                          className="btn btn-light btn-sm"
                          type="button"
                          disabled={products.length < filters.itemsPerPage || loading}
                          onClick={() => onPageChange(filters.pageNumber + 1)}
                        >
                          Next
                        </button>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          className="form-control form-control-sm"
                          style={{ width: '90px' }}
                          value={manualPageInput}
                          onChange={(e) => setManualPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              onManualPageSubmit();
                            }
                          }}
                          placeholder="Page"
                          aria-label="Go to page number"
                          disabled={loading}
                        />
                        <button
                          className="btn btn-outline-primary btn-sm"
                          type="button"
                          onClick={onManualPageSubmit}
                          disabled={loading}
                        >
                          Go
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Product</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleteLoading}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete product{' '}
                    <strong>{selectedProduct?.titleEn || selectedProduct?.title || selectedProduct?.slug || ''}</strong>?
                    This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteProduct} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showStatusModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Product Status</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowStatusModal(false)}
                    disabled={statusUpdatingUUID === statusModalData.uuid}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label mb-1">Product UUID</label>
                    <div className="form-control bg-light">{statusModalData.uuid || '-'}</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label mb-1">Product Name</label>
                    <div className="form-control bg-light">{statusModalData.title || '-'}</div>
                  </div>
                  <div className="mb-0">
                    <label className="form-label">Set Status</label>
                    <select
                      className="form-control"
                      value={statusModalData.status}
                      onChange={(e) => setStatusModalData((prev) => ({ ...prev, status: e.target.value }))}
                      disabled={statusUpdatingUUID === statusModalData.uuid}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    disabled={statusUpdatingUUID === statusModalData.uuid}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-warning"
                    type="button"
                    disabled={!statusModalData.uuid || statusUpdatingUUID === statusModalData.uuid}
                    onClick={async () => {
                      await onUpdateStatus(statusModalData.uuid, statusModalData.status);
                      setShowStatusModal(false);
                    }}
                  >
                    {statusUpdatingUUID === statusModalData.uuid ? 'Updating...' : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showUrgencyModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Product Urgency</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowUrgencyModal(false)}
                    disabled={urgencySavingUUID === urgencyModalData.uuid}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label mb-1">Product Name</label>
                    <div className="form-control bg-light">{urgencyModalData.title || '-'}</div>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="productUrgencyEnabledListing"
                      checked={urgencyModalData.enabled}
                      onChange={(e) =>
                        setUrgencyModalData((prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                          stockCount: e.target.checked ? prev.stockCount : '',
                        }))
                      }
                      disabled={urgencySavingUUID === urgencyModalData.uuid}
                    />
                    <label className="form-check-label" htmlFor="productUrgencyEnabledListing">
                      Enable manual stock override
                    </label>
                  </div>
                  {urgencyModalData.enabled ? (
                    <div className="mb-3">
                      <label className="form-label">Stock Count</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control"
                        value={urgencyModalData.stockCount}
                        onChange={(e) =>
                          setUrgencyModalData((prev) => ({
                            ...prev,
                            stockCount: e.target.value,
                          }))
                        }
                        disabled={urgencySavingUUID === urgencyModalData.uuid}
                      />
                    </div>
                  ) : null}
                  <div className="small text-muted">
                    Resolved stock count: <strong>{urgencyModalData.resolvedStockCount}</strong>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowUrgencyModal(false)}
                    disabled={urgencySavingUUID === urgencyModalData.uuid}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={!urgencyModalData.uuid || urgencySavingUUID === urgencyModalData.uuid}
                    onClick={async () => {
                      await onUpdateUrgency(urgencyModalData.uuid, urgencyModalData.enabled, urgencyModalData.stockCount);
                      setShowUrgencyModal(false);
                    }}
                  >
                    {urgencySavingUUID === urgencyModalData.uuid ? 'Updating...' : 'Update Urgency'}
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

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="screen-center">Loading products...</div>}>
      <ProductsPageContent />
    </Suspense>
  );
}
