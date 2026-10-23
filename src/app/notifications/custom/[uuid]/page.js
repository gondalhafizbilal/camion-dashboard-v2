'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';
import { getNotificationImage } from '@/components/notifications/PushNotificationForm';
import { formatDateTime } from '@/lib/dateTime';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function NotificationViewPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;
  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);

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
    if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw toApiError(payload, response, 'Request failed.');
    return payload;
  }, [token]);

  useEffect(() => {
    if (!token || !uuid) return;
    const loadNotification = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch(`/api/push-notifications/${encodeURIComponent(uuid)}`, { method: 'GET' });
        setNotification(data || null);
      } catch (err) {
        setError(err.message || 'Failed to load custom notification.');
      } finally {
        setLoading(false);
      }
    };
    loadNotification();
  }, [apiFetch, token, uuid]);

  const imageUrl = getNotificationImage(notification);

  if (!isValid) {
    return <div className="screen-center">Loading notification...</div>;
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
                  <h4 className="card-title mb-0">Notification Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href="/notifications/custom" className="btn btn-outline-primary btn-sm">Back</Link>
                    <Link href={`/notifications/custom/${uuid}/edit`} className="btn btn-primary btn-sm">Edit</Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? (
                    <p className="mb-0">Loading notification...</p>
                  ) : notification ? (
                    <div className="row">
                      <div className="col-lg-8">
                        <div className="table-responsive">
                          <table className="table table-bordered">
                            <tbody>
                              <tr><th style={{ width: '220px' }}>UUID</th><td>{notification.uuid || '-'}</td></tr>
                              <tr><th>Title</th><td>{notification.title || '-'}</td></tr>
                              <tr><th>Brief</th><td>{notification.brief || '-'}</td></tr>
                              <tr><th>Message</th><td style={{ whiteSpace: 'pre-wrap' }}>{notification.message || '-'}</td></tr>
                              <tr><th>Priority</th><td>{notification.priority || '-'}</td></tr>
                              <tr><th>Repeat Interval</th><td>{notification.repeatInterval || '-'}</td></tr>
                              <tr><th>Scheduled For</th><td>{formatDateTime(notification.scheduledFor)}</td></tr>
                              <tr><th>Status</th><td>{notification.status || '-'}</td></tr>
                              <tr><th>Created At</th><td>{formatDateTime(notification.createdAt)}</td></tr>
                              <tr><th>Updated At</th><td>{formatDateTime(notification.updatedAt)}</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-lg-4">
                        <div className="card bg-light border-0" style={{ borderRadius: '20px' }}>
                          <div className="card-body">
                            <h5 className="card-title">Image</h5>
                            {imageUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt="Notification"
                                  style={{ width: '100%', maxWidth: '260px', borderRadius: '12px', border: '1px solid #eee' }}
                                />
                              </>
                            ) : (
                              <p className="mb-0 text-muted small">No image uploaded.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mb-0 text-muted">Notification not found.</p>
                  )}
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
