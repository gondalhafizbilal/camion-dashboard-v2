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

export default function UsersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [users, setUsers] = useState([]);
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

      const response = await fetch(path, {
        ...options,
        headers,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError =
          payload?.errors?.error || payload?.errors?.emailAddress || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadUsers = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/users', { method: 'GET' });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onDeleteUser = async (user) => {
    if (!window.confirm(`Delete user "${user.fullName}"?`)) return;

    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/users/${user.uuid}`, {
        method: 'DELETE',
      });
      setMessage('User deleted.');
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user.');
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading users...</div>;
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
                  <h4 className="card-title mb-0">User Management</h4>
                  <Link href="/users/create" className="btn btn-primary btn-sm">
                    Create User
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="d-flex justify-content-end mb-3">
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadUsers}>
                      Refresh
                    </button>
                  </div>

                  {loading ? <p className="mb-0">Loading users...</p> : null}
                  {!loading && users.length === 0 ? <p className="mb-0">No users found.</p> : null}

                  {!loading && users.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Active</th>
                            <th>MFA</th>
                            <th>UUID</th>
                            <th style={{ minWidth: '180px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.uuid}>
                              <td>{user.fullName || '-'}</td>
                              <td>{user.role || '-'}</td>
                              <td>{user.isActive ? 'Yes' : 'No'}</td>
                              <td>{user.isMfaEnabled ? 'Enabled' : 'Disabled'}</td>
                              <td>{user.uuid}</td>
                              <td>
                                <div className="d-flex" style={{ gap: '8px' }}>
                                  <Link href={`/users/${user.uuid}`} className="btn btn-sm btn-outline-dark">
                                    View
                                  </Link>
                                  <Link href={`/users/${user.uuid}/edit`} className="btn btn-sm btn-info">
                                    Edit
                                  </Link>
                                  <button className="btn btn-sm btn-danger" type="button" onClick={() => onDeleteUser(user)}>
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
