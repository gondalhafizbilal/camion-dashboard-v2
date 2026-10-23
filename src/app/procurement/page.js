'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getProxyImageUrl, getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

const INITIAL_FILTERS = {
  keyword: '',
  sort: '',
  priceStart: '',
  priceEnd: '',
  pageNumber: 1,
  itemsPerPage: 20,
};

function normalizeProcurementProductRef(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const decoded = decodeURIComponent(raw);
  const text = decoded.replace(/\s+/g, '');

  if (/^\d+$/.test(text)) {
    return text;
  }

  const offerMatch = text.match(/offer\/(\d+)\.html/i);
  if (offerMatch?.[1]) {
    return offerMatch[1];
  }

  const longDigits = text.match(/(\d{8,})/);
  if (longDigits?.[1]) {
    return longDigits[1];
  }

  return text.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
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

export default function ProcurementPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedExternalIds, setSelectedExternalIds] = useState([]);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportSummary, setBulkImportSummary] = useState(null);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [bulkCategoryUUID, setBulkCategoryUUID] = useState('');
  const [bulkWarehouseUUID, setBulkWarehouseUUID] = useState('');
  const [directProductRef, setDirectProductRef] = useState('');

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

  useEffect(() => {
    if (!token) return;

    const loadDependencies = async () => {
      try {
        const [categoriesData, warehousesData] = await Promise.all([
          apiFetch('/api/categories?itemsPerPage=100&pageNumber=1', { method: 'GET' }),
          apiFetch('/api/warehouses?itemsPerPage=100&pageNumber=1', { method: 'GET' }),
        ]);

        const flattenedCategories = flattenCategories(Array.isArray(categoriesData) ? categoriesData : []);
        const warehouses = Array.isArray(warehousesData) ? warehousesData : [];

        setCategoryOptions(flattenedCategories);
        setWarehouseOptions(warehouses);

        if (warehouses[0]?.uuid) {
          setBulkWarehouseUUID(warehouses[0].uuid);
        }
      } catch {
        setCategoryOptions([]);
        setWarehouseOptions([]);
      }
    };

    loadDependencies();
  }, [apiFetch, token]);

  const toggleSelection = useCallback((externalId) => {
    const normalizedId = String(externalId || '');
    if (!normalizedId) return;
    setSelectedExternalIds((prev) =>
      prev.includes(normalizedId) ? prev.filter((id) => id !== normalizedId) : [...prev, normalizedId]
    );
  }, []);

  const toggleCurrentPageSelection = useCallback(
    (checked) => {
      const currentPageIds = results.map((item) => String(item.externalId || '')).filter(Boolean);
      if (!currentPageIds.length) return;
      setSelectedExternalIds((prev) => {
        if (checked) {
          return Array.from(new Set([...prev, ...currentPageIds]));
        }
        const pageSet = new Set(currentPageIds);
        return prev.filter((id) => !pageSet.has(id));
      });
    },
    [results]
  );

  const clearSelection = useCallback(() => {
    setSelectedExternalIds([]);
    setBulkImportSummary(null);
  }, []);

  const searchProducts = useCallback(
    async (nextFilters = filters) => {
      if (!token) return;
      if (!nextFilters.keyword.trim()) {
        setError('Keyword is required.');
        setResults([]);
        return;
      }

      setLoading(true);
      setError('');
      setBulkImportSummary(null);
      setHasSearched(true);

      try {
        const params = new URLSearchParams({
          keyword: nextFilters.keyword.trim(),
          pageNumber: String(nextFilters.pageNumber),
          itemsPerPage: String(nextFilters.itemsPerPage),
        });

        if (nextFilters.sort) params.set('sort', nextFilters.sort);
        if (nextFilters.priceStart !== '') params.set('priceStart', String(nextFilters.priceStart));
        if (nextFilters.priceEnd !== '') params.set('priceEnd', String(nextFilters.priceEnd));

        const data = await apiFetch(`/api/procurement?${params.toString()}`, { method: 'GET' });
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.results)
              ? data.results
              : Array.isArray(data?.data)
                ? data.data
                : [];
        setResults(list);
      } catch (err) {
        setError(err.message || 'Failed to search procurement products.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, filters, token]
  );

  const onBulkImport = useCallback(async () => {
    if (!selectedExternalIds.length) return;
    if (!bulkCategoryUUID) {
      setError('Please select a category for bulk import.');
      return;
    }
    if (!bulkWarehouseUUID) {
      setError('No warehouse available. Create a warehouse first.');
      return;
    }

    setBulkImportLoading(true);
    setError('');
    setBulkImportSummary(null);
    try {
      const payload = await apiFetch('/api/procurement', {
        method: 'POST',
        body: JSON.stringify({
          externalId: selectedExternalIds,
          categories: [bulkCategoryUUID],
          warehouseUUID: bulkWarehouseUUID,
        }),
      });

      const successCount = Array.isArray(payload?.success) ? payload.success.length : 0;
      const failedCount = Array.isArray(payload?.failed) ? payload.failed.length : 0;
      setBulkImportSummary({
        successCount,
        failedCount,
      });
      setShowBulkImportModal(false);
    } catch (err) {
      setError(err.message || 'Bulk import failed.');
    } finally {
      setBulkImportLoading(false);
    }
  }, [apiFetch, bulkCategoryUUID, bulkWarehouseUUID, selectedExternalIds]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = { ...filters, pageNumber: 1 };
    setFilters(next);
    await searchProducts(next);
  };

  const onPageChange = async (nextPage) => {
    const next = { ...filters, pageNumber: nextPage };
    setFilters(next);
    await searchProducts(next);
  };

  const onOpenDetailFromRef = (event) => {
    event.preventDefault();
    const normalized = normalizeProcurementProductRef(directProductRef);
    if (!normalized) {
      setError('Enter a valid product ID or product URL.');
      return;
    }
    setError('');
    router.push(`/procurement/${encodeURIComponent(normalized)}`);
  };

  if (!isValid) {
    return <div className="screen-center">Loading procurement...</div>;
  }

  const currentPageExternalIds = results.map((item) => String(item.externalId || '')).filter(Boolean);
  const currentPageSelectionCount = currentPageExternalIds.filter((id) => selectedExternalIds.includes(id)).length;
  const isCurrentPageAllSelected = currentPageExternalIds.length > 0 && currentPageSelectionCount === currentPageExternalIds.length;
  const isCurrentPageIndeterminate = currentPageSelectionCount > 0 && currentPageSelectionCount < currentPageExternalIds.length;

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
                <div className="card-header">
                  <h4 className="card-title mb-0">Procurement Search</h4>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit} className="mb-4">
                    <div className="row">
                      <div className="col-md-10 mb-3">
                        <label className="form-label">Open Procurement Detail (Product ID or URL)</label>
                        <input
                          className="form-control"
                          value={directProductRef}
                          onChange={(e) => setDirectProductRef(e.target.value)}
                          placeholder="e.g. 1040581560481 or https://detail.1688.com/offer/1040581560481.html"
                        />
                      </div>
                      <div className="col-md-2 mb-3 d-flex align-items-end">
                        <button className="btn btn-outline-dark w-100" type="button" onClick={onOpenDetailFromRef}>
                          Open Detail
                        </button>
                      </div>
                    </div>
                    <div className="row">
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Keyword *</label>
                        <input
                          className="form-control"
                          value={filters.keyword}
                          onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                          placeholder="Search keyword"
                        />
                      </div>
                      <div className="col-md-2 mb-3">
                        <label className="form-label">Sort</label>
                        <select
                          className="form-control"
                          value={filters.sort}
                          onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                        >
                          <option value="">Default</option>
                          <option value="price">Price</option>
                          <option value="sales">Sales</option>
                        </select>
                      </div>
                      <div className="col-md-2 mb-3">
                        <label className="form-label">Price Start</label>
                        <input
                          className="form-control"
                          value={filters.priceStart}
                          onChange={(e) => setFilters((prev) => ({ ...prev, priceStart: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-2 mb-3">
                        <label className="form-label">Price End</label>
                        <input
                          className="form-control"
                          value={filters.priceEnd}
                          onChange={(e) => setFilters((prev) => ({ ...prev, priceEnd: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-2 mb-3">
                        <label className="form-label">Items/Page</label>
                        <select
                          className="form-control"
                          value={filters.itemsPerPage}
                          onChange={(e) => setFilters((prev) => ({ ...prev, itemsPerPage: Number(e.target.value) }))}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </form>

                  <div className="d-flex flex-wrap align-items-center justify-content-between mb-3" style={{ gap: '10px' }}>
                    <div className="d-flex flex-wrap align-items-center" style={{ gap: '8px' }}>
                      <button
                        className="btn btn-success btn-sm"
                        type="button"
                        disabled={!selectedExternalIds.length || bulkImportLoading}
                        onClick={() => {
                          setError('');
                          setShowBulkImportModal(true);
                        }}
                      >
                        {bulkImportLoading ? 'Importing...' : `Bulk Import (${selectedExternalIds.length})`}
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        disabled={!selectedExternalIds.length || bulkImportLoading}
                        onClick={clearSelection}
                      >
                        Clear Selection
                      </button>
                    </div>
                    <span className="text-muted">
                      Selected IDs: {selectedExternalIds.length}
                    </span>
                  </div>

                  {bulkImportSummary ? (
                    <div className="alert alert-info">
                      Bulk import completed. Success: {bulkImportSummary.successCount}, Failed: {bulkImportSummary.failedCount}
                    </div>
                  ) : null}

                  {loading ? <p className="mb-0">Searching products...</p> : null}
                  {!loading && !hasSearched ? (
                    <p className="mb-0 text-muted">Enter a keyword and click Search to load procurement products.</p>
                  ) : null}
                  {!loading && hasSearched && results.length === 0 ? <p className="mb-0">No products found.</p> : null}

                  {!loading && results.length > 0 ? (
                    <>
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>
                                <input
                                  type="checkbox"
                                  checked={isCurrentPageAllSelected}
                                  ref={(input) => {
                                    if (input) input.indeterminate = isCurrentPageIndeterminate;
                                  }}
                                  onChange={(e) => toggleCurrentPageSelection(e.target.checked)}
                                  disabled={!currentPageExternalIds.length}
                                />
                              </th>
                              <th>External ID</th>
                              <th>Image</th>
                              <th>Title</th>
                              <th>Price</th>
                              <th>Monthly Sales</th>
                              <th>Rating</th>
                              <th>Min Qty</th>
                              <th style={{ minWidth: '140px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.map((item) => (
                              <tr key={item.externalId}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedExternalIds.includes(String(item.externalId || ''))}
                                    onChange={() => toggleSelection(item.externalId)}
                                  />
                                </td>
                                <td>{item.externalId || '-'}</td>
                                <td>
                                  {item.image ? (
                                    <img
                                      src={getProxyImageUrl(getTransformedImageUrl(item.image))}
                                      alt={item.title}
                                      style={{ width: '48px', height: '48px', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>{item.title || '-'}</td>
                                <td>{item.price ?? '-'} </td>
                                <td>{item.monthlySales ?? '-'}</td>
                                <td>{item.rating ?? '-'}</td>
                                <td>{item.minOrderQuantity ?? '-'}</td>
                                <td>
                                  <Link href={`/procurement/${item.externalId}`} className="btn btn-sm btn-outline-dark">
                                    View
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
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
                          disabled={results.length < filters.itemsPerPage || loading}
                          onClick={() => onPageChange(filters.pageNumber + 1)}
                        >
                          Next
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

      {showBulkImportModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Bulk Import Products</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowBulkImportModal(false)}
                    disabled={bulkImportLoading}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-3">
                    Selected products: <strong>{selectedExternalIds.length}</strong>
                  </p>

                  <div className="mb-3">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-control"
                      value={bulkCategoryUUID}
                      onChange={(e) => setBulkCategoryUUID(e.target.value)}
                    >
                      <option value="">Select category</option>
                      {categoryOptions.map((category) => (
                        <option key={category.uuid} value={category.uuid}>
                          {`${'— '.repeat(category.depth)}${category.name || category.nameEn || category.slug || category.uuid}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-0">
                    <label className="form-label">Warehouse *</label>
                    <select
                      className="form-control"
                      value={bulkWarehouseUUID}
                      onChange={(e) => setBulkWarehouseUUID(e.target.value)}
                    >
                      <option value="">Select warehouse</option>
                      {warehouseOptions.map((warehouse) => (
                        <option key={warehouse.uuid} value={warehouse.uuid}>
                          {warehouse.name || warehouse.code || warehouse.uuid}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">Default is first available warehouse.</small>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowBulkImportModal(false)}
                    disabled={bulkImportLoading}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-success" type="button" onClick={onBulkImport} disabled={bulkImportLoading}>
                    {bulkImportLoading ? 'Importing...' : 'Import'}
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
