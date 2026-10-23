'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';
import { getBannerPlacementLabel } from '@/lib/bannerPlacement';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function isValidHexColor(value) {
  return /^#([0-9A-Fa-f]{6})$/.test(String(value || '').trim());
}

function getBannerCategoryNames(banner) {
  if (!Array.isArray(banner?.bannerCategories)) return [];
  return banner.bannerCategories
    .map((item) => item?.category?.nameEn || item?.category?.slug || '')
    .filter(Boolean);
}

export default function BannersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [filters, setFilters] = useState({
    query: '',
    sort: '',
    itemsPerPage: 20,
    pageNumber: 1,
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
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

      if (options.body !== undefined && !headers.has('Content-Type') && typeof options.body === 'string') {
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

  const loadBanners = useCallback(
    async (nextFilters = filters) => {
      if (!token) return;
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('pageNumber', String(nextFilters.pageNumber));
        params.set('itemsPerPage', String(nextFilters.itemsPerPage));
        if (nextFilters.sort) params.set('sort', nextFilters.sort);
        if (nextFilters.query.trim()) {
          params.set('filters', JSON.stringify({ query: nextFilters.query.trim() }));
        }

        const data = await apiFetch(`/api/banners?${params.toString()}`, { method: 'GET' });
        setBanners(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load banners.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, filters, token]
  );

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  const onDeleteBanner = async () => {
    if (!selectedBanner?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/banners/${selectedBanner.uuid}`, { method: 'DELETE' });
      setMessage('Banner deleted.');
      setShowDeleteModal(false);
      setSelectedBanner(null);
      await loadBanners(filters);
    } catch (err) {
      setError(err.message || 'Failed to delete banner.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onApplyFilters = async (event) => {
    event.preventDefault();
    const nextFilters = { ...filters, pageNumber: 1 };
    setFilters(nextFilters);
    await loadBanners(nextFilters);
  };

  const onPageChange = async (nextPageNumber) => {
    const nextFilters = { ...filters, pageNumber: nextPageNumber };
    setFilters(nextFilters);
    await loadBanners(nextFilters);
  };

  if (!isValid) {
    return <div className="screen-center">Loading banners...</div>;
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
                  <h4 className="card-title mb-0">Banners Management</h4>
                  <Link href="/banners/create" className="btn btn-primary btn-sm">
                    Create Banner
                  </Link>
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
                          placeholder="Title, link, placement..."
                          value={filters.query}
                          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-3 mb-2">
                        <label className="form-label">Sort</label>
                        <input
                          className="form-control"
                          placeholder='e.g. {"createdAt":"DESC"}'
                          value={filters.sort}
                          onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                        />
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
                      <div className="col-md-2 mb-2 d-flex align-items-end">
                        <button className="btn btn-primary w-100" type="submit">
                          Apply
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                      <thead>
                        <tr>
                          <th>Image (EN)</th>
                          <th>Image (AR)</th>
                          <th>Title (EN)</th>
                          <th>Title (AR)</th>
                          <th>Link URL</th>
                          <th>Categories</th>
                          <th>Placement</th>
                          <th>Color</th>
                          <th>Active</th>
                          <th style={{ width: '210px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={10} className="text-center">
                              Loading banners...
                            </td>
                          </tr>
                        ) : banners.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center">
                              No banners found.
                            </td>
                          </tr>
                        ) : (
                          banners.map((banner) => (
                            <tr key={banner.uuid}>
                              <td>
                                {banner.imageUrlEn || banner.imageUrl ? (
                                  <img
                                    src={getTransformedImageUrl(banner.imageUrlEn || banner.imageUrl)}
                                    alt={banner.titleEn || 'Banner'}
                                    style={{ width: '100px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                                  />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>
                                {banner.imageUrlAr ? (
                                  <img
                                    src={getTransformedImageUrl(banner.imageUrlAr)}
                                    alt={banner.titleAr || 'Banner'}
                                    style={{ width: '100px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                                  />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>{banner.titleEn || '-'}</td>
                              <td>{banner.titleAr || '-'}</td>
                              <td>{banner.linkUrlEn || banner.linkUrl || '-'}</td>
                              <td>{getBannerCategoryNames(banner).join(', ') || '-'}</td>
                              <td>{getBannerPlacementLabel(banner.placement)}</td>
                              <td>
                                {isValidHexColor(banner.color) ? (
                                  <span
                                    title={banner.color}
                                    style={{
                                      display: 'inline-block',
                                      width: '24px',
                                      height: '14px',
                                      borderRadius: '8px',
                                      backgroundColor: banner.color,
                                      border: '1px solid #d9d9d9',
                                      verticalAlign: 'middle',
                                    }}
                                  />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>{banner.isActive ? 'Yes' : 'No'}</td>
                              <td>
                                <div className="d-flex" style={{ gap: '6px' }}>
                                  <Link href={`/banners/${banner.uuid}`} className="btn btn-info btn-sm">
                                    View
                                  </Link>
                                  <Link href={`/banners/${banner.uuid}/edit`} className="btn btn-primary btn-sm">
                                    Edit
                                  </Link>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    type="button"
                                    onClick={() => {
                                      setSelectedBanner(banner);
                                      setShowDeleteModal(true);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={() => onPageChange(Math.max(1, filters.pageNumber - 1))}
                      disabled={filters.pageNumber <= 1 || loading}
                    >
                      Previous
                    </button>
                    <button className="btn btn-light btn-sm" type="button" disabled>
                      Page {filters.pageNumber}
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      onClick={() => onPageChange(filters.pageNumber + 1)}
                      disabled={loading || banners.length < filters.itemsPerPage}
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
      <Footer />

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Banner</h5>
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">Delete this banner? This action cannot be undone.</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteBanner} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
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
