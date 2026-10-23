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
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function EditPromoPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    text: '',
    callToActionText: '',
    callToActionLink: '',
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
        const backendError = payload?.errors?.error || payload?.errors?.name || payload?.message || 'Request failed.';
        throw new Error(Array.isArray(backendError) ? backendError.join('; ') : backendError);
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !uuid) return;

    const loadPromo = async () => {
      setLoading(true);
      setError('');

      try {
        const promo = await apiFetch(`/api/promos/${uuid}`, { method: 'GET' });
        setFormData({
          name: promo?.name || '',
          text: promo?.text || '',
          callToActionText: promo?.callToActionText || '',
          callToActionLink: promo?.callToActionLink || '',
        });
      } catch (err) {
        setError(err.message || 'Failed to load promo.');
      } finally {
        setLoading(false);
      }
    };

    loadPromo();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.text.trim() || !formData.callToActionText.trim() || !formData.callToActionLink.trim()) {
      setError('All fields are required.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/api/promos/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name.trim(),
          text: formData.text.trim(),
          callToActionText: formData.callToActionText.trim(),
          callToActionLink: formData.callToActionLink.trim(),
        }),
      });

      router.push(`/promos/${uuid}`);
    } catch (err) {
      setError(err.message || 'Failed to update promo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading form...</div>;
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
                  <h4 className="card-title mb-0">Edit Promo</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/promos/${uuid}`} className="btn btn-outline-dark btn-sm">
                      View
                    </Link>
                    <Link href="/promos" className="btn btn-outline-primary btn-sm">
                      Back to List
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  {loading ? <p className="mb-0">Loading promo...</p> : null}

                  {!loading ? (
                    <form onSubmit={onSubmit}>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Name *</label>
                          <input className="form-control" name="name" value={formData.name} onChange={onChange} required maxLength={64} />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Call To Action Text *</label>
                          <input
                            className="form-control"
                            name="callToActionText"
                            value={formData.callToActionText}
                            onChange={onChange}
                            required
                            maxLength={256}
                          />
                        </div>

                        <div className="col-md-12 mb-3">
                          <label className="form-label">Text *</label>
                          <textarea
                            className="form-control"
                            name="text"
                            rows={4}
                            value={formData.text}
                            onChange={onChange}
                            required
                            maxLength={256}
                          />
                        </div>

                        <div className="col-md-12 mb-3">
                          <label className="form-label">Call To Action Link *</label>
                          <input
                            className="form-control"
                            name="callToActionLink"
                            value={formData.callToActionLink}
                            onChange={onChange}
                            required
                            maxLength={256}
                          />
                        </div>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/promos/${uuid}`} className="btn btn-light">
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
