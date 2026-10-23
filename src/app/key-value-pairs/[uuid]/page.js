'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function KeyValuePairShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [item, setItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const loadItem = useCallback(async () => {
    if (!token || !uuid) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(`/api/key-value-pairs/${uuid}`, { method: 'GET' });
      setItem(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load key value pair.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadItem();
  }, [loadItem]);

  const onDelete = async () => {
    if (!uuid) return;

    setDeleting(true);
    setError('');

    try {
      await apiFetch(`/api/key-value-pairs/${uuid}`, { method: 'DELETE' });
      router.push('/key-value-pairs');
    } catch (err) {
      setError(err.message || 'Failed to delete key value pair.');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading key value pair...</div>;
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
                    <h4 className="card-title mb-0">Key Value Pair Details</h4>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <Link href={`/key-value-pairs/${uuid}/edit`} className="btn btn-primary btn-sm">
                        Edit
                      </Link>
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => setShowDeleteModal(true)}>
                        Delete
                      </button>
                      <Link href="/key-value-pairs" className="btn btn-outline-primary btn-sm">
                        Back to List
                      </Link>
                    </div>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}

                    {loading ? <p className="mb-0">Loading key value pair...</p> : null}

                    {!loading && item ? (
                      <div className="table-responsive">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: '260px' }}>UUID</th>
                              <td>{item.uuid || '-'}</td>
                            </tr>
                            <tr>
                              <th>Name</th>
                              <td>{item.name || '-'}</td>
                            </tr>
                            <tr>
                              <th>Type</th>
                              <td>{item.type || '-'}</td>
                            </tr>
                            <tr>
                              <th>Value</th>
                              <td>{getTypedValue(item)}</td>
                            </tr>
                            <tr>
                              <th>Sensitive</th>
                              <td>{String(Boolean(item.sensitive))}</td>
                            </tr>
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
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete key value pair <strong>{item?.name || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDelete} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
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
