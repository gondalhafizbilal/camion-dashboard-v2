'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';
import { getResolvedFrameMediaType } from '@/lib/storyMedia';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function getStoryListPreviewFrame(story) {
  const frames = Array.isArray(story?.frames) ? story.frames : [];
  if (frames.length === 0) return null;
  return frames[0];
}

export default function StoriesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [filters, setFilters] = useState({
    query: '',
    sort: 'DESC',
    itemsPerPage: 20,
    pageNumber: 1,
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

  const loadStories = useCallback(
    async (nextFilters = filters) => {
      if (!token) return;
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        params.set('pageNumber', String(nextFilters.pageNumber));
        params.set('itemsPerPage', String(nextFilters.itemsPerPage));
        if (nextFilters.sort) params.set('sort', nextFilters.sort);
        if (nextFilters.query.trim()) {
          params.set('filters', JSON.stringify({ query: nextFilters.query.trim() }));
        }

        const data = await apiFetch(`/api/stories?${params.toString()}`, { method: 'GET' });
        setStories(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load stories.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, filters, token]
  );

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const onDeleteStory = async () => {
    if (!selectedStory?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/stories/${selectedStory.uuid}`, { method: 'DELETE' });
      setMessage('Story deleted.');
      setShowDeleteModal(false);
      setSelectedStory(null);
      await loadStories(filters);
    } catch (err) {
      setError(err.message || 'Failed to delete story.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onApplyFilters = async (event) => {
    event.preventDefault();
    const nextFilters = { ...filters, pageNumber: 1 };
    setFilters(nextFilters);
    await loadStories(nextFilters);
  };

  const onPageChange = async (nextPageNumber) => {
    const nextFilters = { ...filters, pageNumber: nextPageNumber };
    setFilters(nextFilters);
    await loadStories(nextFilters);
  };

  if (!isValid) {
    return <div className="screen-center">Loading stories...</div>;
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
                  <h4 className="card-title mb-0">Stories Management</h4>
                  <Link href="/stories/create" className="btn btn-primary btn-sm">
                    Create Story
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <form onSubmit={onApplyFilters} className="mb-3">
                    <div className="row">
                      <div className="col-md-4 mb-2">
                        <label className="form-label">Search</label>
                        <input
                          className="form-control"
                          placeholder="Caption..."
                          value={filters.query}
                          onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-3 mb-2">
                        <label className="form-label">Sort</label>
                        <select
                          className="form-control"
                          value={filters.sort}
                          onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value }))}
                        >
                          <option value="DESC">Newest First</option>
                          <option value="ASC">Oldest First</option>
                        </select>
                      </div>
                      <div className="col-md-3 mb-2">
                        <label className="form-label">Items Per Page</label>
                        <select
                          className="form-control"
                          value={filters.itemsPerPage}
                          onChange={(e) => setFilters((prev) => ({ ...prev, itemsPerPage: Number(e.target.value) }))}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>
                      <div className="col-md-2 mb-2 d-flex align-items-end">
                        <button className="btn btn-primary w-100" type="submit">
                          Apply
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                      <thead>
                        <tr>
                          <th>Media</th>
                          <th>Caption (EN)</th>
                          <th>Highlighted</th>
                          <th>Views</th>
                          <th>Frames</th>
                          <th style={{ width: '210px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={6} className="text-center">
                              Loading stories...
                            </td>
                          </tr>
                        ) : stories.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center">
                              No stories found.
                            </td>
                          </tr>
                        ) : (
                          stories.map((story) => (
                            <tr key={story.uuid}>
                              <td>
                                {(() => {
                                  const frame = getStoryListPreviewFrame(story);
                                  if (!frame?.mediaUrl) return '-';
                                  const mediaType = getResolvedFrameMediaType(frame);
                                  const mediaUrl = getTransformedImageUrl(frame.mediaUrl);
                                  return mediaType === 'video' ? (
                                    <button
                                      type="button"
                                      className="btn p-0 border-0 bg-transparent"
                                      onClick={() => setPreviewMedia({ type: mediaType, url: mediaUrl })}
                                    >
                                      <video
                                        src={mediaUrl}
                                        muted
                                        preload="metadata"
                                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }}
                                      />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn p-0 border-0 bg-transparent"
                                      onClick={() => setPreviewMedia({ type: mediaType, url: mediaUrl })}
                                    >
                                      <img
                                        src={mediaUrl}
                                        alt="Story"
                                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px' }}
                                      />
                                    </button>
                                  );
                                })()}
                              </td>
                              <td>{story.captionEn || ''}</td>
                              <td>{story.isHighlighted ? 'Yes' : 'No'}</td>
                              <td>{story.viewsCount ?? 0}</td>
                              <td>{Array.isArray(story.frames) ? story.frames.length : 0}</td>
                              <td>
                                <div className="d-flex" style={{ gap: '6px' }}>
                                  <Link href={`/stories/${story.uuid}`} className="btn btn-info btn-sm">
                                    View
                                  </Link>
                                  <Link href={`/stories/${story.uuid}/edit`} className="btn btn-primary btn-sm">
                                    Edit
                                  </Link>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    type="button"
                                    onClick={() => {
                                      setSelectedStory(story);
                                      setShowDeleteModal(true);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      disabled={filters.pageNumber <= 1 || loading}
                      onClick={() => onPageChange(Math.max(1, filters.pageNumber - 1))}
                    >
                      Previous
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" disabled>
                      Page {filters.pageNumber}
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      disabled={loading || stories.length < filters.itemsPerPage}
                      onClick={() => onPageChange(filters.pageNumber + 1)}
                    >
                      Next
                    </button>
                  </div>
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
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete story <strong>{selectedStory?.captionEn || 'this story'}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteStory} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
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
