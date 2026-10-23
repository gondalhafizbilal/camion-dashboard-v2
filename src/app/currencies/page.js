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

export default function CurrenciesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(null);

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

      const response = await fetch(path, {
        ...options,
        headers,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadCurrencies = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/currencies', { method: 'GET' });
      setCurrencies(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load currencies.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  const onDeleteCurrency = async () => {
    if (!selectedCurrency?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/currencies/${selectedCurrency.uuid}`, { method: 'DELETE' });
      setMessage('Currency deleted.');
      setShowDeleteModal(false);
      setSelectedCurrency(null);
      await loadCurrencies();
    } catch (err) {
      setError(err.message || 'Failed to delete currency.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading currencies...</div>;
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
                    <h4 className="card-title mb-0">Currency Management</h4>
                    <Link href="/currencies/create" className="btn btn-primary btn-sm">
                      Create Currency
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex justify-content-end mb-3">
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadCurrencies}>
                        Refresh
                      </button>
                    </div>

                    {loading ? <p className="mb-0">Loading currencies...</p> : null}
                    {!loading && currencies.length === 0 ? <p className="mb-0">No currencies found.</p> : null}

                    {!loading && currencies.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Alpha Code</th>
                              <th>UUID</th>
                              <th style={{ minWidth: '180px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currencies.map((currency) => (
                              <tr key={currency.uuid}>
                                <td>{currency.name || '-'}</td>
                                <td>{currency.alphaCode || '-'}</td>
                                <td>{currency.uuid || '-'}</td>
                                <td>
                                  <div className="d-flex" style={{ gap: '8px' }}>
                                    <Link href={`/currencies/${currency.uuid}`} className="btn btn-sm btn-outline-dark">
                                      View
                                    </Link>
                                    <Link href={`/currencies/${currency.uuid}/edit`} className="btn btn-sm btn-info">
                                      Edit
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => {
                                        setSelectedCurrency(currency);
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
                  <h5 className="modal-title">Delete Currency</h5>
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
                    Delete currency <strong>{selectedCurrency?.name || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteCurrency} disabled={deleteLoading}>
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
