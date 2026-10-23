'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function EditUserPage() {
  const params = useParams();
  const uuid = params?.uuid;
  const router = useRouter();

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null);
  const [fullNameInput, setFullNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState('user');
  const [isActiveInput, setIsActiveInput] = useState(true);

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
      setFullNameInput(payload?.fullName || '');
      setRoleInput(String(payload?.role || 'user').toLowerCase());
      setIsActiveInput(Boolean(payload?.isActive));
    } catch (err) {
      setError(err.message || 'Failed to load user.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, token]);

  const onSaveName = async (event) => {
    event.preventDefault();
    if (!fullNameInput.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${uuid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName: fullNameInput.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || 'Failed to update user.';
        throw new Error(backendError);
      }
      setMessage('User name updated.');
      await fetchUser();
    } catch (err) {
      setError(err.message || 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdateEmail = async (event) => {
    event.preventDefault();
    if (!emailInput.trim()) {
      setError('Email address is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${uuid}/email-address`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emailAddress: emailInput.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.errors?.emailAddress || payload?.message || 'Failed to update email.';
        throw new Error(backendError);
      }
      setShowEmailModal(false);
      setEmailInput('');
      setMessage('User email updated.');
      await fetchUser();
    } catch (err) {
      setError(err.message || 'Failed to update email.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdatePassword = async (event) => {
    event.preventDefault();
    if (!passwordInput.trim()) {
      setError('Password is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${uuid}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || 'Failed to update password.';
        throw new Error(backendError);
      }
      setShowPasswordModal(false);
      setPasswordInput('');
      setMessage('User password updated.');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdateRole = async () => {
    if (!roleInput) {
      setError('Role is required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${uuid}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: roleInput }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.errors?.role || payload?.message || 'Failed to update role.';
        throw new Error(backendError);
      }
      setMessage('User role updated.');
      await fetchUser();
    } catch (err) {
      setError(err.message || 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  const onUpdateStatus = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/users/${uuid}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: Boolean(isActiveInput) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendError =
          payload?.errors?.error || payload?.errors?.isActive || payload?.message || 'Failed to update status.';
        throw new Error(backendError);
      }
      setMessage('User status updated.');
      await fetchUser();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

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
                  <h4 className="card-title mb-0">Edit User</h4>
                  <Link href="/users" className="btn btn-outline-primary btn-sm">
                    Back to Users
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  {loading ? (
                    <p className="mb-0">Loading user...</p>
                  ) : (
                    <>
                      <div className="mb-3">
                        <strong>UUID:</strong> {user?.uuid}
                      </div>
                      <div className="mb-4">
                        <strong>Role:</strong> {user?.role}
                      </div>
                      <div className="mb-4">
                        <strong>Active:</strong> {user?.isActive ? 'Yes' : 'No'}
                      </div>

                      <form onSubmit={onSaveName}>
                        <div className="form-group mb-3">
                          <label className="mb-2">Full Name</label>
                          <input
                            className="form-control"
                            value={fullNameInput}
                            onChange={(e) => setFullNameInput(e.target.value)}
                          />
                        </div>
                        <button type="submit" className="btn btn-primary mr-2" disabled={saving}>
                          {saving ? 'Saving...' : 'Save Name'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-warning mr-2"
                          onClick={() => setShowEmailModal(true)}
                        >
                          Update Email
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShowPasswordModal(true)}
                        >
                          Update Password
                        </button>
                      </form>

                      <hr />

                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="mb-2">Role</label>
                          <select className="form-control" value={roleInput} onChange={(e) => setRoleInput(e.target.value)}>
                            {ROLE_OPTIONS.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-outline-primary btn-sm mt-2" onClick={onUpdateRole} disabled={saving}>
                            {saving ? 'Saving...' : 'Update Role'}
                          </button>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="mb-2 d-block">Status</label>
                          <div className="form-check mb-2">
                            <input
                              id="edit-user-active"
                              className="form-check-input"
                              type="checkbox"
                              checked={Boolean(isActiveInput)}
                              onChange={(e) => setIsActiveInput(e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="edit-user-active">
                              Active
                            </label>
                          </div>
                          <button type="button" className="btn btn-outline-primary btn-sm" onClick={onUpdateStatus} disabled={saving}>
                            {saving ? 'Saving...' : 'Update Status'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEmailModal ? (
        <div className="cm-modal-overlay">
          <div className="cm-modal-card">
            <h5 className="mb-3">Update Email</h5>
            <form onSubmit={onUpdateEmail}>
              <div className="form-group mb-3">
                <label className="mb-2">New Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <div className="d-flex" style={{ gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  Save
                </button>
                <button type="button" className="btn btn-light" onClick={() => setShowEmailModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPasswordModal ? (
        <div className="cm-modal-overlay">
          <div className="cm-modal-card">
            <h5 className="mb-3">Update Password</h5>
            <form onSubmit={onUpdatePassword}>
              <div className="form-group mb-3">
                <label className="mb-2">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>
              <div className="d-flex" style={{ gap: '8px' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  Save
                </button>
                <button type="button" className="btn btn-light" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <Footer />
    </div>
  );
}
