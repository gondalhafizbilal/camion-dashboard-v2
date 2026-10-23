'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';
import { getNotificationImage } from '@/components/notifications/PushNotificationForm';
import { formatDateTime } from '@/lib/dateTime';

const RECEIVER_TYPES = ['guest', 'customer', 'affiliate', 'influencer', 'allCustomer'];

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function formatScheduleLabel(item) {
  if (item?.repeatInterval) return item.repeatInterval;
  if (item?.scheduledFor) return item.scheduledFor;
  if (item?.scheduledAt) return 'One-time';
  return 'Not scheduled';
}

function getCommonError(err, fallbackMessage) {
  const payload = err?.payload || {};
  const backendError = payload?.errors?.error;
  if (Array.isArray(backendError)) return backendError.filter(Boolean).join(', ');
  if (backendError) return String(backendError);
  if (Array.isArray(payload?.message)) return payload.message.filter(Boolean).join('; ');
  if (payload?.message) return String(payload.message);
  return fallbackMessage;
}

export default function CustomNotificationsPage() {
  const router = useRouter();
  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sendingUuid, setSendingUuid] = useState('');
  const [deletingUuid, setDeletingUuid] = useState('');
  const [stoppingUuid, setStoppingUuid] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({ uuid: '', receiverType: 'allCustomer' });
  const [sendFieldError, setSendFieldError] = useState('');

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

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('authorization', `Bearer ${token}`);

    if (options.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw toApiError(payload, response, 'Request failed.');
    }
    return payload;
  }, [token]);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/push-notifications', { method: 'GET' });
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load custom notifications.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const openSendModal = (uuid) => {
    setSendForm({ uuid, receiverType: 'allCustomer' });
    setSendFieldError('');
    setShowSendModal(true);
  };

  const onSend = async () => {
    if (!sendForm.uuid) return;
    if (!sendForm.receiverType) {
      setSendFieldError('Receiver type is required.');
      return;
    }

    setSendingUuid(sendForm.uuid);
    setError('');
    setSuccess('');
    setSendFieldError('');
    try {
      await apiFetch('/api/push-notifications/push', {
        method: 'POST',
        body: JSON.stringify({
          notificationUUID: [sendForm.uuid],
          receiverType: sendForm.receiverType,
        }),
      });
      setShowSendModal(false);
      setSuccess('Push notification sent.');
      await loadNotifications();
    } catch (err) {
      setSendFieldError(err?.fieldErrors?.receiverType || '');
      setError(getCommonError(err, 'Failed to send push notification.'));
    } finally {
      setSendingUuid('');
    }
  };

  const onStopSchedule = async (uuid) => {
    if (!uuid) return;
    setStoppingUuid(uuid);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/push-notifications/stop/${uuid}`, { method: 'PUT' });
      setSuccess('Notification schedule stopped.');
      await loadNotifications();
    } catch (err) {
      setError(getCommonError(err, 'Failed to stop notification schedule.'));
    } finally {
      setStoppingUuid('');
    }
  };

  const onDelete = async (uuid) => {
    if (!uuid) return;
    if (!window.confirm('Delete this custom notification?')) return;

    setDeletingUuid(uuid);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/push-notifications/${uuid}`, { method: 'DELETE' });
      setSuccess('Custom notification deleted.');
      await loadNotifications();
    } catch (err) {
      setError(getCommonError(err, 'Failed to delete custom notification.'));
    } finally {
      setDeletingUuid('');
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading notifications...</div>;
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
                  <h4 className="card-title mb-0">Custom Notification</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <button className="btn btn-light btn-sm" type="button" onClick={loadNotifications} disabled={loading}>
                      Refresh List
                    </button>
                    <Link href="/notifications/custom/new" className="btn btn-primary btn-sm">
                      Create Notification
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {success ? <div className="alert alert-success">{success}</div> : null}

                  <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Title</th>
                          <th>Brief</th>
                          <th>Priority</th>
                          <th>Schedule</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Updated</th>
                          <th style={{ minWidth: '340px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={9} className="text-center">Loading custom notifications...</td>
                          </tr>
                        ) : notifications.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="text-center">No custom notifications found.</td>
                          </tr>
                        ) : (
                          notifications.map((item) => {
                            const canStop = Boolean(item?.repeatInterval || item?.scheduledFor);
                            const hasAnySchedule = Boolean(item?.scheduledAt || item?.scheduledFor || item?.repeatInterval);
                            const imageUrl = getNotificationImage(item);
                            return (
                              <tr key={item.uuid}>
                                <td style={{ width: '88px' }}>
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt={item?.title || 'Notification'}
                                      style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px' }}
                                    />
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>{item.title || '-'}</td>
                                <td>{item.brief || '-'}</td>
                                <td>{item.priority || '-'}</td>
                                <td>
                                  <div>{formatScheduleLabel(item)}</div>
                                  <small className="text-muted">{formatDateTime(item.scheduledAt || item.scheduledFor)}</small>
                                </td>
                                <td>{item.status || '-'}</td>
                                <td>{formatDateTime(item.createdAt)}</td>
                                <td>{formatDateTime(item.updatedAt)}</td>
                                <td>
                                  <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                                    <Link href={`/notifications/custom/${item.uuid}`} className="btn btn-outline-dark btn-sm">
                                      View
                                    </Link>
                                    <Link href={`/notifications/custom/${item.uuid}/edit`} className="btn btn-info btn-sm">
                                      Edit
                                    </Link>
                                    {!hasAnySchedule ? (
                                      <button
                                        className="btn btn-primary btn-sm"
                                        type="button"
                                        onClick={() => openSendModal(item.uuid)}
                                        disabled={sendingUuid === item.uuid}
                                      >
                                        {sendingUuid === item.uuid ? 'Sending...' : 'Send'}
                                      </button>
                                    ) : null}
                                    {canStop ? (
                                      <button
                                        className="btn btn-warning btn-sm"
                                        type="button"
                                        onClick={() => onStopSchedule(item.uuid)}
                                        disabled={stoppingUuid === item.uuid}
                                      >
                                        {stoppingUuid === item.uuid ? 'Stopping...' : 'Stop Schedule'}
                                      </button>
                                    ) : null}
                                    <button
                                      className="btn btn-danger btn-sm"
                                      type="button"
                                      onClick={() => onDelete(item.uuid)}
                                      disabled={deletingUuid === item.uuid}
                                    >
                                      {deletingUuid === item.uuid ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {showSendModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Send Push Notification</h5>
                  <button type="button" className="close" onClick={() => setShowSendModal(false)} disabled={Boolean(sendingUuid)}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Receiver Type</label>
                  <select
                    className={`form-control${sendFieldError ? ' is-invalid' : ''}`}
                    value={sendForm.receiverType}
                    onChange={(event) => {
                      setSendForm((prev) => ({ ...prev, receiverType: event.target.value }));
                      setSendFieldError('');
                    }}
                  >
                    {RECEIVER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {sendFieldError ? <div className="text-danger small mt-1">{sendFieldError}</div> : null}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowSendModal(false)} disabled={Boolean(sendingUuid)}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={onSend} disabled={Boolean(sendingUuid)}>
                    {sendingUuid ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </div>
  );
}
