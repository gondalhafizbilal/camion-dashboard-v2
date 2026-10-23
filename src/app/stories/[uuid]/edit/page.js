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
import {
  getFrameMediaType,
  getResolvedFrameMediaType,
  STORY_MEDIA_TYPE_OPTIONS,
  normalizeStoryMediaType,
} from '@/lib/storyMedia';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function EditStoryPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mediaTypeSaving, setMediaTypeSaving] = useState(false);
  const [deletingFrameUUID, setDeletingFrameUUID] = useState('');
  const [previewMedia, setPreviewMedia] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [formData, setFormData] = useState({
    captionEn: '',
    isHighlighted: false,
    mediaType: 'image',
  });
  const [frames, setFrames] = useState([]);

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
      setFormData({
        captionEn: data?.captionEn || '',
        isHighlighted: Boolean(data?.isHighlighted),
        mediaType: normalizeStoryMediaType(data?.mediaType || data?.media_type),
      });
      setFrames(
        Array.isArray(data?.frames)
          ? data.frames.map((frame, index) => ({
              ...frame,
              mediaType: getFrameMediaType(frame),
              duration: String(frame?.duration ?? 5),
              order: String(frame?.order ?? index),
            }))
          : []
      );
    } catch (err) {
      setError(err.message || 'Failed to load story.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

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

  const updateFrameMeta = useCallback(
    async (storyUUID) => {
      for (const frame of frames) {
        await apiFetch(`/api/stories/${storyUUID}/frames/${frame.uuid}`, {
          method: 'PUT',
          body: JSON.stringify({
            duration: toNumber(frame.duration, 5),
            order: toNumber(frame.order, 0),
          }),
        });
      }
    },
    [apiFetch, frames]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!formData.captionEn.trim()) {
      setError('Caption (English) is required.');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await apiFetch(`/api/stories/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          caption: {
            en: formData.captionEn.trim(),
            // Backend DTO currently requires non-empty ar; single-space passes validation and is stored trimmed as empty.
            ar: ' ',
          },
          isHighlighted: Boolean(formData.isHighlighted),
          mediaType: normalizeStoryMediaType(formData.mediaType),
        }),
      });

      if (updated?.uuid) {
        await uploadFrames(updated.uuid);
        await updateFrameMeta(updated.uuid);
      }

      setMessage('Story updated successfully.');
      await loadStory();
      setImageFiles([]);
      setVideoFiles([]);
    } catch (err) {
      setError(err.message || 'Failed to update story.');
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdateMediaTypeOnly = async () => {
    if (!uuid) return;
    setMediaTypeSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/stories/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          mediaType: normalizeStoryMediaType(formData.mediaType),
        }),
      });
      setMessage('Story media type updated.');
      await loadStory();
    } catch (err) {
      setError(err.message || 'Failed to update media type.');
    } finally {
      setMediaTypeSaving(false);
    }
  };

  const onDeleteFrame = async (frameUUID) => {
    if (!uuid || !frameUUID) return;
    setDeletingFrameUUID(frameUUID);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/stories/${uuid}/frames/${frameUUID}`, { method: 'DELETE' });
      setFrames((prev) => prev.filter((item) => item.uuid !== frameUUID));
      setMessage('Frame deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete frame.');
    } finally {
      setDeletingFrameUUID('');
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading story edit form...</div>;
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
                  <h4 className="card-title mb-0">Edit Story</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/stories/${uuid}`} className="btn btn-outline-primary btn-sm">
                      View Story
                    </Link>
                    <Link href="/stories" className="btn btn-light btn-sm">
                      Back to Stories
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  {loading ? <p className="mb-0">Loading story...</p> : null}

                  {!loading ? (
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
                            <div className="mt-2">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={onUpdateMediaTypeOnly}
                                disabled={mediaTypeSaving || submitting}
                              >
                                {mediaTypeSaving ? 'Updating...' : 'Update Media Type Only'}
                              </button>
                            </div>
                          </div>

                        {normalizeStoryMediaType(formData.mediaType) === 'image' ? (
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Add Images</label>
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
                            <label className="form-label">Add Videos</label>
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

                      <h5 className="mb-2">Frame Media</h5>
                      <div className="table-responsive mb-3">
                        <table className="table table-bordered">
                          <thead>
                            <tr>
                              <th>Preview</th>
                              <th>Duration</th>
                              <th>Order</th>
                              <th>Media Type</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {frames.length > 0 ? (
                              frames.map((frame) => (
                                <tr key={frame.uuid}>
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
                                  <td>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={frame.duration}
                                      onChange={(e) =>
                                        setFrames((prev) =>
                                          prev.map((item) =>
                                            item.uuid === frame.uuid ? { ...item, duration: e.target.value } : item
                                          )
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      className="form-control"
                                      value={frame.order}
                                      onChange={(e) =>
                                        setFrames((prev) =>
                                          prev.map((item) => (item.uuid === frame.uuid ? { ...item, order: e.target.value } : item))
                                        )
                                      }
                                    />
                                  </td>
                                  <td>
                                    {getResolvedFrameMediaType(frame).toUpperCase()}
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      disabled={deletingFrameUUID === frame.uuid}
                                      onClick={() => onDeleteFrame(frame.uuid)}
                                    >
                                      {deletingFrameUUID === frame.uuid ? 'Deleting...' : 'Delete'}
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="text-center">
                                  No frames found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/stories/${uuid}`} className="btn btn-light">
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
    </>
  );
}
