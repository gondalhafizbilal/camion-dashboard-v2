'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';
import { getFrameMediaType, getResolvedFrameMediaType } from '@/lib/storyMedia';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function StoryShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [story, setStory] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

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

  const loadStory = useCallback(async () => {
    if (!token || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/stories/${uuid}`, { method: 'GET' });
      setStory(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load story.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  const onDeleteStory = async () => {
    if (!uuid) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/api/stories/${uuid}`, { method: 'DELETE' });
      router.push('/stories');
    } catch (err) {
      setError(err.message || 'Failed to delete story.');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading story...</div>;
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
                  <h4 className="card-title mb-0">Story Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/stories/${uuid}/edit`} className="btn btn-primary btn-sm">
                      Edit
                    </Link>
                    <button className="btn btn-danger btn-sm" type="button" onClick={() => setShowDeleteModal(true)}>
                      Delete
                    </button>
                    <Link href="/stories" className="btn btn-outline-primary btn-sm">
                      Back to Stories
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading story...</p> : null}

                  {!loading && story ? (
                    <>
                      <div className="table-responsive mb-4">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th>Caption (EN)</th>
                              <td>{story.captionEn || ''}</td>
                            </tr>
                            <tr>
                              <th>Highlighted</th>
                              <td>{story.isHighlighted ? 'Yes' : 'No'}</td>
                            </tr>
                            <tr>
                              <th>Views</th>
                              <td>{story.viewsCount ?? 0}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h5 className="mb-3">Frames</h5>
                      <div className="table-responsive">
                        <table className="table table-striped table-bordered">
                          <thead>
                            <tr>
                              <th>Media Type</th>
                              <th>Media</th>
                              <th>Duration</th>
                              <th>Order</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(story.frames) && story.frames.length > 0 ? (
                              story.frames.map((frame) => (
                                <tr key={frame.uuid}>
                                  <td>{getFrameMediaType(frame).toUpperCase()}</td>
                                  <td>
                                    {frame.mediaUrl ? (
                                      getResolvedFrameMediaType(frame) === 'video' ? (
                                        <button
                                          type="button"
                                          className="btn p-0 border-0 bg-transparent"
                                          onClick={() =>
                                            setPreviewMedia({ type: 'video', url: getTransformedImageUrl(frame.mediaUrl) })
                                          }
                                        >
                                          <video
                                            src={getTransformedImageUrl(frame.mediaUrl)}
                                            muted
                                            preload="metadata"
                                            style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '8px' }}
                                          />
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn p-0 border-0 bg-transparent"
                                          onClick={() =>
                                            setPreviewMedia({ type: 'image', url: getTransformedImageUrl(frame.mediaUrl) })
                                          }
                                        >
                                          <img
                                            src={getTransformedImageUrl(frame.mediaUrl)}
                                            alt="Story frame"
                                            style={{ width: '88px', height: '88px', objectFit: 'cover', borderRadius: '8px' }}
                                          />
                                        </button>
                                      )
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                  <td>{frame.duration ?? 5}</td>
                                  <td>{frame.order ?? 0}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="text-center">
                                  No frames found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Story</h5>
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">Delete this story permanently?</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteStory} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {previewMedia ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Media Preview</h5>
                  <button type="button" className="close" onClick={() => setPreviewMedia(null)}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body text-center">
                  {previewMedia.type === 'video' ? (
                    <video src={previewMedia.url} controls style={{ width: '100%', maxHeight: '70vh' }} />
                  ) : (
                    <img src={previewMedia.url} alt="Story media" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setPreviewMedia(null)} />
        </>
      ) : null}
    </div>
  );
}
