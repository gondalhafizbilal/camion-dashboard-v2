'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

const SummernotePostEditor = dynamic(() => import('@/components/SummernotePostEditor'), { ssr: false });

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    brief: '',
    content: '',
    enabled: true,
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

    const loadPost = async () => {
      setLoading(true);
      setError('');

      try {
        const post = await apiFetch(`/api/posts/${uuid}`, { method: 'GET' });
        setFormData({
          slug: post?.slug || '',
          title: post?.title || '',
          brief: post?.brief || '',
          content: post?.content || '',
          enabled: post?.enabled !== false,
        });
      } catch (err) {
        setError(err.message || 'Failed to load post.');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.slug.trim() || !formData.title.trim() || !formData.content.trim()) {
      setError('Slug, title and content are required.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/api/posts/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          slug: formData.slug.trim(),
          title: formData.title.trim(),
          brief: formData.brief.trim() || undefined,
          content: formData.content.trim(),
          enabled: Boolean(formData.enabled),
        }),
      });

      router.push(`/posts/${uuid}`);
    } catch (err) {
      setError(err.message || 'Failed to update post.');
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
                  <h4 className="card-title mb-0">Edit Post</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/posts/${uuid}`} className="btn btn-outline-dark btn-sm">
                      View
                    </Link>
                    <Link href="/posts" className="btn btn-outline-primary btn-sm">
                      Back to List
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  {loading ? <p className="mb-0">Loading post...</p> : null}

                  {!loading ? (
                    <form onSubmit={onSubmit}>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Slug *</label>
                          <input className="form-control" name="slug" value={formData.slug} onChange={onChange} required maxLength={128} />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Title *</label>
                          <input className="form-control" name="title" value={formData.title} onChange={onChange} required maxLength={256} />
                        </div>

                        <div className="col-md-12 mb-3">
                          <label className="form-label">Brief</label>
                          <textarea className="form-control" name="brief" rows={3} value={formData.brief} onChange={onChange} maxLength={512} />
                        </div>

                        <div className="col-md-12 mb-3">
                          <SummernotePostEditor
                            label="Content"
                            value={formData.content}
                            onChange={(nextHtml) => setFormData((prev) => ({ ...prev, content: nextHtml }))}
                          />
                        </div>

                        <div className="col-md-12 mb-3">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="enabled" name="enabled" checked={formData.enabled} onChange={onChange} />
                            <label className="form-check-label" htmlFor="enabled">
                              Enabled
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/posts/${uuid}`} className="btn btn-light">
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
