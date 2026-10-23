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

export default function LanguagesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(null);

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

  const loadLanguages = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/languages', { method: 'GET' });
      setLanguages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load languages.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  const onDeleteLanguage = async () => {
    if (!selectedLanguage?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/languages/${selectedLanguage.uuid}`, { method: 'DELETE' });
      setMessage('Language deleted.');
      setShowDeleteModal(false);
      setSelectedLanguage(null);
      await loadLanguages();
    } catch (err) {
      setError(err.message || 'Failed to delete language.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading languages...</div>;
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
                    <h4 className="card-title mb-0">Language Management</h4>
                    <Link href="/languages/create" className="btn btn-primary btn-sm">
                      Create Language
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex justify-content-end mb-3">
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadLanguages}>
                        Refresh
                      </button>
                    </div>

                    {loading ? <p className="mb-0">Loading languages...</p> : null}
                    {!loading && languages.length === 0 ? <p className="mb-0">No languages found.</p> : null}

                    {!loading && languages.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Short Code</th>
                              <th>UUID</th>
                              <th style={{ minWidth: '180px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {languages.map((language) => (
                              <tr key={language.uuid}>
                                <td>{language.name || '-'}</td>
                                <td>{language.shortCode || '-'}</td>
                                <td>{language.uuid || '-'}</td>
                                <td>
                                  <div className="d-flex" style={{ gap: '8px' }}>
                                    <Link href={`/languages/${language.uuid}`} className="btn btn-sm btn-outline-dark">
                                      View
                                    </Link>
                                    <Link href={`/languages/${language.uuid}/edit`} className="btn btn-sm btn-info">
                                      Edit
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => {
                                        setSelectedLanguage(language);
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
                  <h5 className="modal-title">Delete Language</h5>
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
                    Delete language <strong>{selectedLanguage?.name || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteLanguage} disabled={deleteLoading}>
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
