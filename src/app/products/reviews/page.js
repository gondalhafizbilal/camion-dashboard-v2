'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import ProductAjaxSearchSelect from '@/components/products/ProductAjaxSearchSelect';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';
import { getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function getReviewImageSrc(reviewImage) {
  return getTransformedImageUrl(reviewImage?.thumbnailUrl || reviewImage?.imageUrl || '');
}

export default function ProductReviewsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [deletingReviewUuid, setDeletingReviewUuid] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [initialProductUuid, setInitialProductUuid] = useState('');
  const [reviews, setReviews] = useState([]);

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

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setInitialProductUuid(String(params.get('productUuid') || '').trim());
  }, []);

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

  const loadReviews = useCallback(
    async (productUuid) => {
      if (!token || !productUuid) {
        setReviews([]);
        return;
      }
      setLoadingReviews(true);
      setError('');
      try {
        const data = await apiFetch(`/api/products/${encodeURIComponent(productUuid)}/reviews`, { method: 'GET' });
        setReviews(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load product reviews.');
        setReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    },
    [apiFetch, token]
  );

  useEffect(() => {
    if (!selectedProduct?.uuid) {
      setReviews([]);
      return;
    }
    loadReviews(selectedProduct.uuid);
  }, [loadReviews, selectedProduct]);

  const onDeleteReview = async (reviewUuid) => {
    if (!selectedProduct?.uuid || !reviewUuid) return;
    const confirmed = window.confirm('Delete this review?');
    if (!confirmed) return;

    setDeletingReviewUuid(reviewUuid);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${encodeURIComponent(selectedProduct.uuid)}/reviews/${encodeURIComponent(reviewUuid)}`, {
        method: 'DELETE',
      });
      setMessage('Review deleted.');
      await loadReviews(selectedProduct.uuid);
    } catch (err) {
      setError(err.message || 'Failed to delete review.');
    } finally {
      setDeletingReviewUuid('');
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading product reviews...</div>;
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
                  <h4 className="card-title mb-0">Product Reviews</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link
                      href={
                        selectedProduct?.uuid
                          ? `/products/reviews/new?productUuid=${encodeURIComponent(selectedProduct.uuid)}&returnTo=${encodeURIComponent(
                              `/products/reviews?productUuid=${encodeURIComponent(selectedProduct.uuid)}`
                            )}`
                          : `/products/reviews/new?returnTo=${encodeURIComponent('/products/reviews')}`
                      }
                      className="btn btn-primary btn-sm"
                    >
                      Create Review
                    </Link>
                    <Link href="/products" className="btn btn-outline-primary btn-sm">
                      Back to Products
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="mb-4">
                    <ProductAjaxSearchSelect
                      apiFetch={apiFetch}
                      selectedProductUuid={selectedProduct?.uuid || initialProductUuid}
                      selectedProduct={selectedProduct}
                      onSelectProduct={setSelectedProduct}
                      label="Filter Reviews By Product"
                    />
                  </div>

                  {selectedProduct?.uuid ? (
                    <div
                      className="mb-4"
                      style={{
                        background: '#f8f9fb',
                        border: '1px solid #eef1f6',
                        borderRadius: '16px',
                        padding: '16px 18px',
                      }}
                    >
                      <div className="d-flex align-items-center" style={{ gap: '14px' }}>
                        {getTransformedImageUrl(selectedProduct.featuredThumbnailUrl || selectedProduct.featuredImageUrl) ? (
                          <img
                            src={getTransformedImageUrl(selectedProduct.featuredThumbnailUrl || selectedProduct.featuredImageUrl)}
                            alt={selectedProduct.titleEn || selectedProduct.slug || 'Product'}
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
                            {selectedProduct.titleEn || selectedProduct.slug || '-'}
                          </div>
                          <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                            {selectedProduct.slug || '-'}
                          </div>
                          <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                            UUID: {selectedProduct.uuid || '-'}
                          </div>
                          <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                            Procurement ID: {selectedProduct.procurementId || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="d-flex justify-content-end mb-3">
                    <button
                      className="btn btn-outline-primary btn-sm"
                      type="button"
                      onClick={() => loadReviews(selectedProduct?.uuid || '')}
                      disabled={loadingReviews || !selectedProduct?.uuid}
                    >
                      {loadingReviews ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>

                  {!selectedProduct?.uuid ? <p className="mb-0 text-muted">Select a product to view its reviews.</p> : null}
                  {selectedProduct?.uuid && loadingReviews ? <p className="mb-0">Loading reviews...</p> : null}
                  {selectedProduct?.uuid && !loadingReviews && reviews.length === 0 ? (
                    <p className="mb-0 text-muted">No reviews found for this product.</p>
                  ) : null}

                  {selectedProduct?.uuid && !loadingReviews && reviews.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>Product</th>
                            <th>Rating</th>
                            <th>Comment</th>
                            <th>Edited</th>
                            <th>Images</th>
                            <th style={{ minWidth: '180px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviews.map((review) => (
                            <tr key={review.uuid}>
                              <td>
                                <div>{review.customer?.fullName || '-'}</div>
                                <small className="text-muted">{review.customer?.emailAddress || '-'}</small>
                              </td>
                              <td>
                                <div className="d-flex align-items-center" style={{ gap: '10px' }}>
                                  {getTransformedImageUrl(selectedProduct.featuredThumbnailUrl || selectedProduct.featuredImageUrl) ? (
                                    <img
                                      src={getTransformedImageUrl(selectedProduct.featuredThumbnailUrl || selectedProduct.featuredImageUrl)}
                                      alt={selectedProduct.titleEn || selectedProduct.slug || 'Product'}
                                      style={{
                                        width: '48px',
                                        height: '48px',
                                        objectFit: 'cover',
                                        borderRadius: '10px',
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        flex: '0 0 auto',
                                      }}
                                    />
                                  ) : (
                                    <div
                                      style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '10px',
                                        border: '1px dashed #d1d5db',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#6b7280',
                                        fontSize: '11px',
                                        flex: '0 0 auto',
                                      }}
                                    >
                                      -
                                    </div>
                                  )}
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                                      {selectedProduct.titleEn || selectedProduct.slug || '-'}
                                    </div>
                                    <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                      {selectedProduct.uuid || '-'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>{review.rating ?? '-'}</td>
                              <td style={{ whiteSpace: 'pre-wrap', minWidth: '240px' }}>{review.comment || '-'}</td>
                              <td>{review.isEdited ? 'Yes' : 'No'}</td>
                              <td>
                                <div className="d-flex align-items-center" style={{ gap: '8px', flexWrap: 'wrap' }}>
                                  {Array.isArray(review.images) && review.images.length > 0 ? (
                                    review.images.slice(0, 3).map((image) => {
                                      const src = getReviewImageSrc(image);
                                      if (!src) return null;
                                      return (
                                        <img
                                          key={image.uuid || src}
                                          src={src}
                                          alt="Review"
                                          style={{
                                            width: '36px',
                                            height: '36px',
                                            objectFit: 'cover',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb',
                                            background: '#fff',
                                          }}
                                        />
                                      );
                                    })
                                  ) : (
                                    <span className="text-muted">0</span>
                                  )}
                                  {Array.isArray(review.images) && review.images.length > 3 ? (
                                    <span className="small text-muted">+{review.images.length - 3}</span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                <div className="d-flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
                                  <Link
                                    className="btn btn-info btn-xs"
                                    href={`/products/reviews/${encodeURIComponent(selectedProduct.uuid)}/${encodeURIComponent(review.uuid)}`}
                                  >
                                    View
                                  </Link>
                                  <button
                                    className="btn btn-outline-danger btn-xs"
                                    type="button"
                                    onClick={() => onDeleteReview(review.uuid)}
                                    disabled={deletingReviewUuid === review.uuid}
                                  >
                                    {deletingReviewUuid === review.uuid ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
