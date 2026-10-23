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

export default function ExchangeRatesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [rates, setRates] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedRate, setSelectedRate] = useState(null);

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
        const backendError = payload?.errors?.error || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }
      return payload;
    },
    [token]
  );

  const loadRates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('pageNumber', String(pageNumber));
      params.set('itemsPerPage', String(itemsPerPage));
      const data = await apiFetch(`/api/exchange-rates?${params.toString()}`, { method: 'GET' });
      setRates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load exchange rates.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, itemsPerPage, pageNumber, token]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const onChangeItemsPerPage = (value) => {
    setPageNumber(1);
    setItemsPerPage(value);
  };

  const onDeleteRate = async () => {
    if (!selectedRate?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/exchange-rates/${selectedRate.uuid}`, { method: 'DELETE' });
      setMessage('Exchange rate deleted.');
      setShowDeleteModal(false);
      setSelectedRate(null);
      await loadRates();
    } catch (err) {
      setError(err.message || 'Failed to delete exchange rate.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading exchange rates...</div>;

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
                    <h4 className="card-title mb-0">Exchange Rate Management</h4>
                    <Link href="/exchange-rates/create" className="btn btn-primary btn-sm">
                      Create Exchange Rate
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex justify-content-end mb-3">
                      <div className="d-flex align-items-center flex-wrap" style={{ gap: '8px' }}>
                        <select
                          className="form-control"
                          style={{ width: '140px' }}
                          value={itemsPerPage}
                          onChange={(e) => onChangeItemsPerPage(Number(e.target.value))}
                          disabled={loading}
                        >
                          {[10, 20, 50, 100].map((value) => (
                            <option key={value} value={value}>
                              {value} / page
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadRates} disabled={loading}>
                          {loading ? 'Loading...' : 'Refresh'}
                        </button>
                      </div>
                    </div>

                    {loading ? <p className="mb-0">Loading exchange rates...</p> : null}
                    {!loading && rates.length === 0 ? <p className="mb-0">No exchange rates found.</p> : null}

                    {!loading && rates.length > 0 ? (
                      <>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>Source Currency</th>
                                <th>Target Currency</th>
                                <th>Factor</th>
                                <th>UUID</th>
                                <th style={{ minWidth: '180px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rates.map((rate) => (
                                <tr key={rate.uuid}>
                                  <td>{String(rate.srcCurrencyCode || '').toUpperCase() || '-'}</td>
                                  <td>{String(rate.targetCurrencyCode || '').toUpperCase() || '-'}</td>
                                  <td>{rate.factor ?? '-'}</td>
                                  <td>{rate.uuid || '-'}</td>
                                  <td>
                                    <div className="d-flex" style={{ gap: '8px' }}>
                                      <Link href={`/exchange-rates/${rate.uuid}`} className="btn btn-sm btn-outline-dark">
                                        View
                                      </Link>
                                      <Link href={`/exchange-rates/${rate.uuid}/edit`} className="btn btn-sm btn-info">
                                        Edit
                                      </Link>
                                      <button
                                        className="btn btn-sm btn-danger"
                                        type="button"
                                        onClick={() => {
                                          setSelectedRate(rate);
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
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={pageNumber <= 1 || loading}
                            onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                          >
                            Previous
                          </button>
                          <span className="text-muted small">Page {pageNumber}</span>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={loading || rates.length < itemsPerPage}
                            onClick={() => setPageNumber((prev) => prev + 1)}
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
                  <h5 className="modal-title">Delete Exchange Rate</h5>
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
                    Delete exchange rate <strong>{selectedRate?.srcCurrencyCode || ''} → {selectedRate?.targetCurrencyCode || ''}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteRate} disabled={deleteLoading}>
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
