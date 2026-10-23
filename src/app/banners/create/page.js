'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

export default function CreateBannerPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fileEn, setFileEn] = useState(null);
  const [fileAr, setFileAr] = useState(null);

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

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mergedMessage = Array.isArray(payload?.message) ? payload.message.join('; ') : payload?.message;
        const backendError = payload?.errors?.error || mergedMessage || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!fileEn || !fileAr) {
      setError('Both English and Arabic image files are required.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('fileEn', fileEn);
      formData.append('fileAr', fileAr);
      const banner = await apiFetch('/api/banners', {
        method: 'POST',
        body: formData,
      });

      setMessage('Banner created. Redirecting to edit...');
      if (banner?.uuid) {
        router.push(`/banners/${banner.uuid}/edit`);
      } else {
        router.push('/banners');
      }
    } catch (err) {
      setError(err.message || 'Failed to create banner.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading banner form...</div>;
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
                  <h4 className="card-title mb-0">Create Banner</h4>
                  <Link href="/banners" className="btn btn-outline-primary btn-sm">
                    Back to Banners
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Banner Image (English) *</label>
                      <input
                        className="form-control"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFileEn(e.target.files?.[0] || null)}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Banner Image (Arabic) *</label>
                      <input
                        className="form-control"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFileAr(e.target.files?.[0] || null)}
                      />
                      <small className="form-text text-muted">After upload, complete title/link/placement in edit page.</small>
                    </div>

                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Uploading...' : 'Create Banner'}
                      </button>
                      <Link href="/banners" className="btn btn-light">
                        Cancel
                      </Link>
                    </div>
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
