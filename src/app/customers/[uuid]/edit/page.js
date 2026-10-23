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
  return (
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.emailAddress || 'User'
  );
}

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
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
        const backendError = payload?.errors?.error || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !uuid) return;

    const loadCustomer = async () => {
      setLoading(true);
      setError('');
      try {
        const customer = await apiFetch(`/api/customers/${uuid}`, { method: 'GET' });
        setFormData({
          fullName: customer?.fullName || '',
        });
      } catch (err) {
        setError(err.message || 'Failed to load customer.');
      } finally {
        setLoading(false);
      }
    };

    loadCustomer();
  }, [apiFetch, token, uuid]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/customers/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
        }),
      });
      router.push(`/customers/${uuid}`);
    } catch (err) {
      setError(err.message || 'Failed to update customer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading customer form...</div>;
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
                  <h4 className="card-title mb-0">Edit Customer</h4>
                  <Link href={`/customers/${uuid}`} className="btn btn-outline-primary btn-sm">
                    Back to Customer
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading customer...</p> : null}

                  {!loading ? (
                    <form onSubmit={onSubmit}>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Full Name</label>
                          <input
                            className="form-control"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ fullName: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/customers/${uuid}`} className="btn btn-light">
                          Cancel
                        </Link>
                      </div>
                    </form>
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

