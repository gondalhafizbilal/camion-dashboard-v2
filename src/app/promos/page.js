'use client';

import Link from 'next/link';
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

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function PromosPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [filters, setFilters] = useState({
    pageNumber: 1,
    itemsPerPage: 20,
    sort: '',
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

      if (options.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.errors?.name || payload?.message || 'Request failed.';
        throw new Error(Array.isArray(backendError) ? backendError.join('; ') : backendError);
      }

      return payload;
    },
    [token]
  );

  const loadPromos = useCallback(
    async (nextFilters = filters) => {
      if (!token) return;

      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('pageNumber', String(nextFilters.pageNumber));
        params.set('itemsPerPage', String(nextFilters.itemsPerPage));
        if (nextFilters.sort) params.set('sort', nextFilters.sort);

        const data = await apiFetch(`/api/promos?${params.toString()}`, { method: 'GET' });
        setPromos(toList(data));
      } catch (err) {
        setError(err.message || 'Failed to load promos.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, filters, token]
  );

  useEffect(() => {
    loadPromos(filters);
  }, [filters, loadPromos]);

  const onDeletePromo = async () => {
    if (!selectedPromo?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/promos/${selectedPromo.uuid}`, { method: 'DELETE' });
      setMessage('Promo deleted.');
      setShowDeleteModal(false);
      setSelectedPromo(null);
      await loadPromos(filters);
    } catch (err) {
      setError(err.message || 'Failed to delete promo.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading promos...</div>;
  }

  return (
    <>
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
                    <h4 className="card-title mb-0">Promo Management</h4>
                    <Link href="/promos/create" className="btn btn-primary btn-sm">
                      Create Promo
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex flex-wrap justify-content-end align-items-center mb-3" style={{ gap: '8px' }}>
                      <select
                        className="form-control form-control-sm"
                        style={{ width: '150px' }}
                        value={filters.sort}
                        onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value, pageNumber: 1 }))}
                      >
                        <option value="">Sort</option>
                        <option value="asc">Name (A-Z)</option>
                        <option value="desc">Name (Z-A)</option>
                      </select>
                      <select
                        className="form-control form-control-sm"
                        style={{ width: '120px' }}
                        value={filters.itemsPerPage}
                        onChange={(e) => setFilters((prev) => ({ ...prev, itemsPerPage: Number(e.target.value), pageNumber: 1 }))}
                      >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                      </select>
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => loadPromos(filters)}>
                        Refresh
                      </button>
                    </div>

                    {loading ? <p className="mb-0">Loading promos...</p> : null}
                    {!loading && promos.length === 0 ? <p className="mb-0">No promos found.</p> : null}

                    {!loading && promos.length > 0 ? (
                      <>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>Text</th>
                                <th>CTA Text</th>
                                <th>CTA Link</th>
                                <th style={{ minWidth: '220px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {promos.map((promo) => (
                                <tr key={promo.uuid}>
                                  <td>{promo.name || '-'}</td>
                                  <td style={{ maxWidth: '380px' }}>{promo.text || '-'}</td>
                                  <td>{promo.callToActionText || '-'}</td>
                                  <td>{promo.callToActionLink || '-'}</td>
                                  <td>
                                    <div className="d-flex" style={{ gap: '8px' }}>
                                      <Link href={`/promos/${promo.uuid}`} className="btn btn-sm btn-outline-dark">
                                        View
                                      </Link>
                                      <Link href={`/promos/${promo.uuid}/edit`} className="btn btn-sm btn-info">
                                        Edit
                                      </Link>
                                      <button
                                        className="btn btn-sm btn-danger"
                                        type="button"
                                        onClick={() => {
                                          setSelectedPromo(promo);
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

                        <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={filters.pageNumber <= 1 || loading}
                            onClick={() => setFilters((prev) => ({ ...prev, pageNumber: prev.pageNumber - 1 }))}
                          >
                            Previous
                          </button>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={promos.length < filters.itemsPerPage || loading}
                            onClick={() => setFilters((prev) => ({ ...prev, pageNumber: prev.pageNumber + 1 }))}
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
      </div>

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Promo</h5>
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
                    Delete promo <strong>{selectedPromo?.name || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeletePromo} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </>
  );
}
