'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

export default function UserShowPage() {
  const params = useParams();
  const uuid = params?.uuid;
  const router = useRouter();

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const currentUserName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const currentUserRole = useMemo(() => getUserRole(auth?.user), [auth?.user]);

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

  useEffect(() => {
    const fetchUser = async () => {
      if (!uuid || !token) return;

      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/users/${uuid}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const backendError = payload?.errors?.error || payload?.message || 'Failed to load user.';
          throw new Error(backendError);
        }
        setUser(payload);
      } catch (err) {
        setError(err.message || 'Failed to load user.');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [uuid, token]);

  if (!isValid) {
    return <div className="screen-center">Loading...</div>;
  }

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={currentUserName} role={currentUserRole} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h4 className="card-title mb-0">User Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    {user?.uuid ? (
                      <Link href={`/users/${user.uuid}/edit`} className="btn btn-info btn-sm">
                        Edit
                      </Link>
                    ) : null}
                    <Link href="/users" className="btn btn-outline-primary btn-sm">
                      Back to Users
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading user...</p> : null}

                  {!loading && user ? (
                    <div className="table-responsive">
                      <table className="table table-bordered mb-0">
                        <tbody>
                          <tr>
                            <th style={{ width: '220px' }}>UUID</th>
                            <td>{user.uuid || '-'}</td>
                          </tr>
                          <tr>
                            <th>Full Name</th>
                            <td>{user.fullName || '-'}</td>
                          </tr>
                          <tr>
                            <th>Role</th>
                            <td>{user.role || '-'}</td>
                          </tr>
                          <tr>
                            <th>Active</th>
                            <td>{user.isActive ? 'Yes' : 'No'}</td>
                          </tr>
                          <tr>
                            <th>MFA Enabled</th>
                            <td>{user.isMfaEnabled ? 'Yes' : 'No'}</td>
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
  );
}
