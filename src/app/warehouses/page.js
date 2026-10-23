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

export default function WarehousesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const loadWarehouses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/warehouses', { method: 'GET' });
      setWarehouses(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load warehouses.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  const onDeleteWarehouse = async (warehouse) => {
    if (!window.confirm(`Delete warehouse "${warehouse.name}"?`)) return;

    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/warehouses/${warehouse.uuid}`, { method: 'DELETE' });
      setMessage('Warehouse deleted.');
      await loadWarehouses();
    } catch (err) {
      setError(err.message || 'Failed to delete warehouse.');
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading warehouses...</div>;
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
                  <h4 className="card-title mb-0">Warehouse Management</h4>
                  <Link href="/warehouses/create" className="btn btn-primary btn-sm">
                    Create Warehouse
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="d-flex justify-content-end mb-3">
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadWarehouses}>
                      Refresh
                    </button>
                  </div>

                  {loading ? <p className="mb-0">Loading warehouses...</p> : null}
                  {!loading && warehouses.length === 0 ? <p className="mb-0">No warehouses found.</p> : null}

                  {!loading && warehouses.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Country</th>
                            <th>State</th>
                            <th>City</th>
                            <th>Active</th>
                            <th style={{ minWidth: '220px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {warehouses.map((warehouse) => (
                            <tr key={warehouse.uuid}>
                              <td>{warehouse.name || '-'}</td>
                              <td>{warehouse.code || '-'}</td>
                              <td>{warehouse.country || '-'}</td>
                              <td>{warehouse.state || '-'}</td>
                              <td>{warehouse.city || '-'}</td>
                              <td>{warehouse.isActive ? 'Yes' : 'No'}</td>
                              <td>
                                <div className="d-flex" style={{ gap: '8px' }}>
                                  <Link href={`/warehouses/${warehouse.uuid}`} className="btn btn-sm btn-outline-dark">
                                    View
                                  </Link>
                                  <Link href={`/warehouses/${warehouse.uuid}/edit`} className="btn btn-sm btn-info">
                                    Edit
                                  </Link>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    type="button"
                                    onClick={() => onDeleteWarehouse(warehouse)}
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
  );
}
