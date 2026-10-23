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

export default function WarehouseShowPage() {
  const params = useParams();
  const uuid = params?.uuid;
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warehouse, setWarehouse] = useState(null);

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
    const fetchWarehouse = async () => {
      if (!uuid || !token) return;

      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/warehouses/${uuid}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const backendError = payload?.errors?.error || payload?.error || payload?.message || 'Failed to load warehouse.';
          throw new Error(backendError);
        }
        setWarehouse(payload);
      } catch (err) {
        setError(err.message || 'Failed to load warehouse.');
      } finally {
        setLoading(false);
      }
    };

    fetchWarehouse();
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
                  <h4 className="card-title mb-0">Warehouse Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    {warehouse?.uuid ? (
                      <Link href={`/warehouses/${warehouse.uuid}/edit`} className="btn btn-info btn-sm">
                        Edit
                      </Link>
                    ) : null}
                    <Link href="/warehouses" className="btn btn-outline-primary btn-sm">
                      Back to Warehouses
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading warehouse...</p> : null}

                  {!loading && warehouse ? (
                    <div className="table-responsive">
                      <table className="table table-bordered mb-0">
                        <tbody>
                          <tr>
                            <th style={{ width: '240px' }}>UUID</th>
                            <td>{warehouse.uuid || '-'}</td>
                          </tr>
                          <tr>
                            <th>Name</th>
                            <td>{warehouse.name || '-'}</td>
                          </tr>
                          <tr>
                            <th>Code</th>
                            <td>{warehouse.code || '-'}</td>
                          </tr>
                          <tr>
                            <th>Address Line 1</th>
                            <td>{warehouse.addressLine1 || '-'}</td>
                          </tr>
                          <tr>
                            <th>Address Line 2</th>
                            <td>{warehouse.addressLine2 || '-'}</td>
                          </tr>
                          <tr>
                            <th>Country</th>
                            <td>{warehouse.country || '-'}</td>
                          </tr>
                          <tr>
                            <th>State</th>
                            <td>{warehouse.state || '-'}</td>
                          </tr>
                          <tr>
                            <th>City</th>
                            <td>{warehouse.city || '-'}</td>
                          </tr>
                          <tr>
                            <th>Gulltrans Warehouse ID</th>
                            <td>{warehouse.gulltransWarehouseId || '-'}</td>
                          </tr>
                          <tr>
                            <th>Gulltrans User ID</th>
                            <td>{warehouse.gulltransUserId || '-'}</td>
                          </tr>
                          <tr>
                            <th>Active</th>
                            <td>{warehouse.isActive ? 'Yes' : 'No'}</td>
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
