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

export default function CustomerShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

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
        const backendError = payload?.errors?.error || payload?.errors?.emailAddress || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadCustomer = useCallback(async () => {
    if (!token || !uuid) return;

    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/customers/${uuid}`, { method: 'GET' });
      setCustomer(data || null);
      setEmailValue(data?.emailAddress || '');
    } catch (err) {
      setError(err.message || 'Failed to load customer.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const onDelete = async () => {
    if (!uuid) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/api/customers/${uuid}`, { method: 'DELETE' });
      router.push('/customers');
    } catch (err) {
      setError(err.message || 'Failed to delete customer.');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const onUpdateEmail = async () => {
    if (!uuid || !emailValue.trim()) {
      setError('Email address is required.');
      return;
    }

    setEmailSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/customers/${uuid}/email-address`, {
        method: 'PUT',
        body: JSON.stringify({
          emailAddress: emailValue.trim().toLowerCase(),
        }),
      });
      setShowEmailModal(false);
      setMessage('Customer email updated.');
      await loadCustomer();
    } catch (err) {
      setError(err.message || 'Failed to update email address.');
    } finally {
      setEmailSaving(false);
    }
  };

  const onUpdatePassword = async () => {
    if (!uuid || passwordValue.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setPasswordSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/customers/${uuid}/password`, {
        method: 'PUT',
        body: JSON.stringify({
          password: passwordValue,
        }),
      });
      setShowPasswordModal(false);
      setPasswordValue('');
      setMessage('Customer password updated.');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading customer...</div>;
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
                    <h4 className="card-title mb-0">Customer Details</h4>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <Link href={`/customers/${uuid}/edit`} className="btn btn-primary btn-sm">
                        Edit
                      </Link>
                      <button className="btn btn-outline-dark btn-sm" type="button" onClick={() => setShowEmailModal(true)}>
                        Update Email
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        onClick={() => setShowPasswordModal(true)}
                      >
                        Update Password
                      </button>
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => setShowDeleteModal(true)}>
                        Delete
                      </button>
                      <Link href="/customers" className="btn btn-outline-primary btn-sm">
                        Back to Customers
                      </Link>
                    </div>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}
                    {loading ? <p className="mb-0">Loading customer...</p> : null}

                    {!loading && customer ? (
                      <div className="table-responsive">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: '260px' }}>UUID</th>
                              <td>{customer.uuid || '-'}</td>
                            </tr>
                            <tr>
                              <th>Full Name</th>
                              <td>{customer.fullName || '-'}</td>
                            </tr>
                            <tr>
                              <th>Email Address</th>
                              <td>{customer.emailAddress || '-'}</td>
                            </tr>
                            <tr>
                              <th>Phone Number</th>
                              <td>{customer.phoneNumber || '-'}</td>
                            </tr>
                            <tr>
                              <th>Email Verified</th>
                              <td>{customer.isEmailAddressVerified ? 'Yes' : 'No'}</td>
                            </tr>
                            <tr>
                              <th>Phone Verified</th>
                              <td>{customer.isPhoneNumberVerified ? 'Yes' : 'No'}</td>
                            </tr>
                            <tr>
                              <th>Active</th>
                              <td>{customer.isActive ? 'Yes' : 'No'}</td>
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
                  <h5 className="modal-title">Delete Customer</h5>
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete customer <strong>{customer?.fullName || ''}</strong>? This action cannot be undone.
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

      {showEmailModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Email Address</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowEmailModal(false)}
                    disabled={emailSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowEmailModal(false)} disabled={emailSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdateEmail} disabled={emailSaving}>
                    {emailSaving ? 'Saving...' : 'Save Email'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showPasswordModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Password</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passwordSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    minLength={8}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passwordSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdatePassword} disabled={passwordSaving}>
                    {passwordSaving ? 'Saving...' : 'Save Password'}
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

