'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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

export default function CreateWarehousePage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    addressLine1: '',
    addressLine2: '',
    country: 'pak',
    state: '',
    city: '',
    gulltransWarehouseId: '',
    gulltransUserId: '',
  });

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  if (!isValid) {
    clearAuth();
    router.replace('/login');
    return <div className="screen-center">Loading...</div>;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name || !form.code || !form.addressLine1 || !form.country || !form.state || !form.city) {
      setError('Name, code, address line 1, country, state and city are required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/warehouses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          country: form.country.toLowerCase(),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || 'Failed to create warehouse.';
        throw new Error(backendError);
      }

      router.push('/warehouses');
    } catch (err) {
      setError(err.message || 'Failed to create warehouse.');
    } finally {
      setSubmitting(false);
    }
  };

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
                  <h4 className="card-title mb-0">Create Warehouse</h4>
                  <Link href="/warehouses" className="btn btn-outline-primary btn-sm">
                    Back to Warehouses
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Name</label>
                        <input
                          className="form-control"
                          value={form.name}
                          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Code</label>
                        <input
                          className="form-control"
                          value={form.code}
                          onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Address Line 1</label>
                        <input
                          className="form-control"
                          value={form.addressLine1}
                          onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Address Line 2</label>
                        <input
                          className="form-control"
                          value={form.addressLine2}
                          onChange={(e) => setForm((prev) => ({ ...prev, addressLine2: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="mb-2">Country (ISO3)</label>
                        <input
                          className="form-control"
                          value={form.country}
                          maxLength={3}
                          onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value.toLowerCase() }))}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="mb-2">State</label>
                        <input
                          className="form-control"
                          value={form.state}
                          onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="mb-2">City</label>
                        <input
                          className="form-control"
                          value={form.city}
                          onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Gulltrans Warehouse ID</label>
                        <input
                          className="form-control"
                          value={form.gulltransWarehouseId}
                          onChange={(e) => setForm((prev) => ({ ...prev, gulltransWarehouseId: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="mb-2">Gulltrans User ID</label>
                        <input
                          className="form-control"
                          value={form.gulltransUserId}
                          onChange={(e) => setForm((prev) => ({ ...prev, gulltransUserId: e.target.value }))}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create Warehouse'}
                    </button>
                  </form>
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
