'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { STORY_MEDIA_TYPE_OPTIONS, normalizeStoryMediaType } from '@/lib/storyMedia';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function CreateStoryPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    captionEn: '',
    isHighlighted: false,
    mediaType: 'image',
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);

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

      if (options.body !== undefined && !headers.has('Content-Type') && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mergedMessage = Array.isArray(payload?.message) ? payload.message.join('; ') : payload?.message;
        const backendError = payload?.errors?.error || payload?.errors?.slug || mergedMessage || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const uploadFrames = useCallback(
    async (storyUUID) => {
      const files =
        normalizeStoryMediaType(formData.mediaType) === 'video' ? [...videoFiles] : [...imageFiles];
      for (const file of files) {
        const frameData = new FormData();
        frameData.append('file', file);
        await apiFetch(`/api/stories/${storyUUID}/frames`, {
          method: 'POST',
          body: frameData,
        });
      }
    },
    [apiFetch, formData.mediaType, imageFiles, videoFiles]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.captionEn.trim()) {
      setError('Caption (English) is required.');
      return;
    }

    setSubmitting(true);
    try {
      const story = await apiFetch('/api/stories', {
        method: 'POST',
        body: JSON.stringify({
          caption: {
            en: formData.captionEn.trim(),
            // Backend DTO currently requires non-empty ar; single-space passes validation and is stored trimmed as empty.
            ar: ' ',
          },
          isHighlighted: Boolean(formData.isHighlighted),
        }),
      });

      if (story?.uuid) {
        await uploadFrames(story.uuid);
      }

      router.push('/stories');
    } catch (err) {
      setError(err.message || 'Failed to create story.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading story form...</div>;
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
                  <h4 className="card-title mb-0">Create Story</h4>
                  <Link href="/stories" className="btn btn-outline-primary btn-sm">
                    Back to Stories
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="row">
                      <div className="col-md-12 mb-3">
                        <label className="form-label">Caption (English)</label>
                        <input
                          className="form-control"
                          value={formData.captionEn}
                          onChange={(e) => setFormData((prev) => ({ ...prev, captionEn: e.target.value }))}
                          maxLength={256}
                          required
                        />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Media Type</label>
                        <select
                          className="form-control"
                          value={formData.mediaType}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, mediaType: normalizeStoryMediaType(e.target.value) }))
                          }
                        >
                          {STORY_MEDIA_TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                              {type.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      {normalizeStoryMediaType(formData.mediaType) === 'image' ? (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Upload Images</label>
                          <input
                            type="file"
                            className="form-control"
                            accept="image/*"
                            multiple
                            onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                          />
                        </div>
                      ) : (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Upload Videos</label>
                          <input
                            type="file"
                            className="form-control"
                            accept="video/*"
                            multiple
                            onChange={(e) => setVideoFiles(Array.from(e.target.files || []))}
                          />
                        </div>
                      )}

                      <div className="col-md-12 mb-3">
                        <small className="text-muted">
                          Only selected media type files will be uploaded.
                        </small>
                      </div>

                      <div className="col-md-12 mb-3">
                        <div className="form-check">
                          <input
                            id="highlighted"
                            className="form-check-input"
                            type="checkbox"
                            checked={formData.isHighlighted}
                            onChange={(e) => setFormData((prev) => ({ ...prev, isHighlighted: e.target.checked }))}
                          />
                          <label className="form-check-label" htmlFor="highlighted">
                            Highlight this story
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Story'}
                      </button>
                      <Link href="/stories" className="btn btn-light">
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
