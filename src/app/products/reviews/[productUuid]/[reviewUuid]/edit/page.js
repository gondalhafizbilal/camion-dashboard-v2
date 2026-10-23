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
import { getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function normalizeReviewErrors(payload) {
  const source = payload?.errors || {};
  return {
    rating: source?.rating || '',
    comment: source?.comment || '',
  };
}

function getReviewImageSrc(reviewImage) {
  return getTransformedImageUrl(reviewImage?.thumbnailUrl || reviewImage?.imageUrl || '');
}

export default function EditProductReviewPage() {
  const router = useRouter();
  const params = useParams();
  const productUuid = params?.productUuid;
  const reviewUuid = params?.reviewUuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [product, setProduct] = useState(null);
  const [review, setReview] = useState(null);
  const [formData, setFormData] = useState({ rating: '5', comment: '' });

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
        throw toApiError(payload, response, 'Request failed.');
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !productUuid || !reviewUuid) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [productData, reviewData] = await Promise.all([
          apiFetch(`/api/products/${encodeURIComponent(productUuid)}`, { method: 'GET' }),
          apiFetch(`/api/products/${encodeURIComponent(productUuid)}/reviews/${encodeURIComponent(reviewUuid)}`, { method: 'GET' }),
        ]);
        setProduct(productData || null);
        setReview(reviewData || null);
        setFormData({
          rating: String(reviewData?.rating ?? '5'),
          comment: String(reviewData?.comment || ''),
        });
      } catch (err) {
        setError(err.message || 'Failed to load review.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [apiFetch, productUuid, reviewUuid, token]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (!formData.comment.trim() || !formData.rating) {
      setError('Rating and comment are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/products/${encodeURIComponent(productUuid)}/reviews/${encodeURIComponent(reviewUuid)}`, {
        method: 'PUT',
        body: JSON.stringify({
          rating: Number(formData.rating),
          comment: formData.comment.trim(),
        }),
      });
      router.push(`/products/reviews?productUuid=${encodeURIComponent(productUuid)}`);
    } catch (err) {
      setFieldErrors(normalizeReviewErrors(err?.payload || {}));
      setError(err.message || 'Failed to update review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading product review...</div>;
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
                  <h4 className="card-title mb-0">Edit Product Review</h4>
                  <Link href={`/products/reviews?productUuid=${encodeURIComponent(productUuid || '')}`} className="btn btn-outline-primary btn-sm">
                    Back to Reviews
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading review...</p> : null}

                  {!loading ? (
                    <>
                      <div className="card bg-light border-0 mb-4" style={{ borderRadius: '16px' }}>
                        <div className="card-body">
                          <div className="d-flex align-items-center" style={{ gap: '14px' }}>
                            {getTransformedImageUrl(product?.featuredThumbnailUrl || product?.featuredImageUrl) ? (
                              <img
                                src={getTransformedImageUrl(product?.featuredThumbnailUrl || product?.featuredImageUrl)}
                                alt={product?.titleEn || product?.slug || 'Product'}
                                style={{
                                  width: '72px',
                                  height: '72px',
                                  objectFit: 'cover',
                                  borderRadius: '12px',
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  flex: '0 0 auto',
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: '72px',
                                  height: '72px',
                                  borderRadius: '12px',
                                  border: '1px dashed #d1d5db',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#6b7280',
                                  fontSize: '12px',
                                  flex: '0 0 auto',
                                }}
                              >
                                No image
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '18px', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                                {product?.titleEn || product?.slug || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                {product?.slug || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                UUID: {product?.uuid || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                Procurement ID: {product?.procurementId || '-'}
                              </div>
                              <div className="small mt-2">Customer: {review?.customer?.fullName || '-'}</div>
                              <div className="small text-muted">{review?.customer?.emailAddress || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="card border-0 mb-4" style={{ borderRadius: '16px', background: '#f8f9fb' }}>
                        <div className="card-body">
                          <h6 className="mb-3">Review Images</h6>
                          <div className="d-flex align-items-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
                            {Array.isArray(review?.images) && review.images.length > 0 ? (
                              review.images.map((image) => {
                                const src = getReviewImageSrc(image);
                                if (!src) return null;
                                return (
                                  <img
                                    key={image.uuid || src}
                                    src={src}
                                    alt="Review image"
                                    style={{
                                      width: '56px',
                                      height: '56px',
                                      objectFit: 'cover',
                                      borderRadius: '10px',
                                      border: '1px solid #e5e7eb',
                                      background: '#fff',
                                    }}
                                  />
                                );
                              })
                            ) : (
                              <span className="text-muted">No images uploaded.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <form onSubmit={onSubmit}>
                        <div className="row">
                          <div className="col-md-6 mb-3">
                            <label className="form-label">Rating</label>
                            <select
                              className={`form-control${fieldErrors.rating ? ' is-invalid' : ''}`}
                              value={formData.rating}
                              onChange={(event) => setFormData((prev) => ({ ...prev, rating: event.target.value }))}
                            >
                              <option value="5">5</option>
                              <option value="4">4</option>
                              <option value="3">3</option>
                              <option value="2">2</option>
                              <option value="1">1</option>
                            </select>
                            {fieldErrors.rating ? <div className="invalid-feedback">{fieldErrors.rating}</div> : null}
                          </div>
                          <div className="col-md-12 mb-3">
                            <label className="form-label">Comment</label>
                            <textarea
                              className={`form-control${fieldErrors.comment ? ' is-invalid' : ''}`}
                              value={formData.comment}
                              onChange={(event) => setFormData((prev) => ({ ...prev, comment: event.target.value }))}
                              rows={6}
                              maxLength={512}
                              required
                            />
                            {fieldErrors.comment ? <div className="invalid-feedback">{fieldErrors.comment}</div> : null}
                          </div>
                        </div>
                        <div className="d-flex" style={{ gap: '8px' }}>
                          <button className="btn btn-primary" type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Changes'}
                          </button>
                          <Link href={`/products/reviews?productUuid=${encodeURIComponent(productUuid || '')}`} className="btn btn-light">
                            Cancel
                          </Link>
                        </div>
                      </form>
                    </>
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
