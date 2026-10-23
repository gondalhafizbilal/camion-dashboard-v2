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

function getTypedValue(item) {
  const type = String(item?.type || '').toLowerCase();
  if (type === 'integer') return String(item?.integerValue ?? '-');
  if (type === 'decimal') return String(item?.decimalValue ?? '-');
  if (type === 'string') return item?.stringValue || '-';
  if (type === 'boolean') return String(Boolean(item?.booleanValue));
  return '-';
}

export default function KeyValuePairsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

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

  const loadItems = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/key-value-pairs', { method: 'GET' });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load key value pairs.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const onDelete = async () => {
    if (!selectedItem?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/key-value-pairs/${selectedItem.uuid}`, { method: 'DELETE' });
      setMessage('Key value pair deleted.');
      setShowDeleteModal(false);
      setSelectedItem(null);
      await loadItems();
    } catch (err) {
      setError(err.message || 'Failed to delete key value pair.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading key value pairs...</div>;
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
                    <h4 className="card-title mb-0">Key Value Pair Management</h4>
                    <Link href="/key-value-pairs/create" className="btn btn-primary btn-sm">
                      Create Key Value Pair
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex justify-content-end mb-3">
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadItems}>
                        Refresh
                      </button>
                    </div>

                    {loading ? <p className="mb-0">Loading key value pairs...</p> : null}
                    {!loading && items.length === 0 ? <p className="mb-0">No key value pairs found.</p> : null}

                    {!loading && items.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Type</th>
                              <th>Value</th>
                              <th>Sensitive</th>
                              <th>UUID</th>
                              <th style={{ minWidth: '180px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.uuid}>
                                <td>{item.name || '-'}</td>
                                <td>{item.type || '-'}</td>
                                <td>{getTypedValue(item)}</td>
                                <td>{String(Boolean(item.sensitive))}</td>
                                <td>{item.uuid || '-'}</td>
                                <td>
                                  <div className="d-flex" style={{ gap: '8px' }}>
                                    <Link href={`/key-value-pairs/${item.uuid}`} className="btn btn-sm btn-outline-dark">
                                      View
                                    </Link>
                                    <Link href={`/key-value-pairs/${item.uuid}/edit`} className="btn btn-sm btn-info">
                                      Edit
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => {
                                        setSelectedItem(item);
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
                  <h5 className="modal-title">Delete Key Value Pair</h5>
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
                    Delete key value pair <strong>{selectedItem?.name || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDelete} disabled={deleteLoading}>
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
