'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

function getBannerCategoryItems(banner) {
  if (!Array.isArray(banner?.bannerCategories)) return [];
  return banner.bannerCategories
    .map((item) => {
      const category = item?.category || item || {};
      return {
        uuid: category?.uuid || item?.uuid || '',
        label: category?.nameEn || category?.name || category?.slug || '',
        slug: category?.slug || '',
      };
    })
    .filter((item) => item.label);
}

export default function BannerShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const loadBanner = useCallback(async () => {
    if (!token || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/banners/${uuid}`, { method: 'GET' });
      setBanner(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load banner.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadBanner();
  }, [loadBanner]);

  const onDeleteBanner = async () => {
    if (!uuid) return;
    setDeleteLoading(true);
    setError('');
    try {
      await apiFetch(`/api/banners/${uuid}`, { method: 'DELETE' });
      router.push('/banners');
    } catch (err) {
      setError(err.message || 'Failed to delete banner.');
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading banner...</div>;
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
                  <h4 className="card-title mb-0">Banner Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/banners/${uuid}/edit`} className="btn btn-primary btn-sm">
                      Edit
                    </Link>
                    <button className="btn btn-danger btn-sm" type="button" onClick={() => setShowDeleteModal(true)}>
                      Delete
                    </button>
                    <Link href="/banners" className="btn btn-outline-primary btn-sm">
                      Back to Banners
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading banner...</p> : null}

                  {!loading && banner ? (
                    <>
                      {banner.imageUrlEn || banner.imageUrlAr || banner.imageUrl ? (
                        <div className="row mb-4">
                          {(banner.imageUrlEn || banner.imageUrl) ? (
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Image (English)</label>
                              <div>
                                <img
                                  src={getTransformedImageUrl(banner.imageUrlEn || banner.imageUrl)}
                                  alt={banner.titleEn || 'Banner English'}
                                  style={{ width: '420px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #eee' }}
                                />
                              </div>
                            </div>
                          ) : null}
                          {banner.imageUrlAr ? (
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Image (Arabic)</label>
                              <div>
                                <img
                                  src={getTransformedImageUrl(banner.imageUrlAr)}
                                  alt={banner.titleAr || 'Banner Arabic'}
                                  style={{ width: '420px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #eee' }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="table-responsive">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: '260px' }}>UUID</th>
                              <td>{banner.uuid || '-'}</td>
                            </tr>
                            <tr>
                              <th>Title (EN)</th>
                              <td>{banner.titleEn || '-'}</td>
                            </tr>
                            <tr>
                              <th>Title (AR)</th>
                              <td>{banner.titleAr || '-'}</td>
                            </tr>
                            <tr>
                              <th>Image URL (EN)</th>
                              <td>{banner.imageUrlEn || banner.imageUrl || '-'}</td>
                            </tr>
                            <tr>
                              <th>Image URL (AR)</th>
                              <td>{banner.imageUrlAr || '-'}</td>
                            </tr>
                            <tr>
                              <th>Link URL (EN)</th>
                              <td>{banner.linkUrlEn || banner.linkUrl || '-'}</td>
                            </tr>
                            <tr>
                              <th>Link URL (AR)</th>
                              <td>{banner.linkUrlAr || banner.linkUrl || '-'}</td>
                            </tr>
                            <tr>
                              <th>Placement</th>
                              <td>{getBannerPlacementLabel(banner.placement)}</td>
                            </tr>
                            <tr>
                              <th>Categories</th>
                              <td>
                                {getBannerCategoryItems(banner).length > 0 ? (
                                  <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                    {getBannerCategoryItems(banner).map((category) => (
                                      <span
                                        key={category.uuid || category.label}
                                        className="badge badge-light border text-dark"
                                        style={{ whiteSpace: 'normal', lineHeight: 1.4 }}
                                      >
                                        {category.slug && category.slug !== category.label ? `${category.label} (${category.slug})` : category.label}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                            <tr>
                              <th>Color</th>
                              <td>{banner.color || '-'}</td>
                            </tr>
                            <tr>
                              <th>Active</th>
                              <td>{banner.isActive ? 'Yes' : 'No'}</td>
                            </tr>
                          </tbody>
                        </table>
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
