'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

const ROLE_OPTIONS = ['super-admin', 'admin', 'manager', 'user'];

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function CreateUserPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    emailAddress: '',
    password: '',
    role: 'user',
    isActive: true,
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

    if (!form.fullName || !form.emailAddress || !form.password) {
      setError('Full name, email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const backendError =
          payload?.errors?.error || payload?.errors?.emailAddress || payload?.message || 'Failed to create user.';
        throw new Error(backendError);
      }

      router.push('/users');
    } catch (err) {
      setError(err.message || 'Failed to create user.');
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
                  <h4 className="card-title mb-0">Create User</h4>
                  <Link href="/users" className="btn btn-outline-primary btn-sm">
                    Back to Users
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="form-group mb-3">
                      <label className="mb-2">Full Name</label>
                      <input
                        className="form-control"
                        value={form.fullName}
                        onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                      />
                    </div>

                    <div className="form-group mb-3">
                      <label className="mb-2">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        value={form.emailAddress}
                        onChange={(e) => setForm((prev) => ({ ...prev, emailAddress: e.target.value }))}
                      />
                    </div>

                    <div className="form-group mb-3">
                      <label className="mb-2">Password</label>
                      <input
                        type="password"
                        className="form-control"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                      />
                    </div>

                    <div className="form-group mb-4">
                      <label className="mb-2">Role</label>
                      <select
                        className="form-control"
                        value={form.role}
                        onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                      >
                        {ROLE_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group mb-4">
                      <div className="form-check">
                        <input
                          id="create-user-active"
                          className="form-check-input"
                          type="checkbox"
                          checked={Boolean(form.isActive)}
                          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        />
                        <label className="form-check-label" htmlFor="create-user-active">
                          Active
                        </label>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? 'Creating...' : 'Create User'}
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
