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

function getReviewImageSrc(reviewImage) {
  return getTransformedImageUrl(reviewImage?.thumbnailUrl || reviewImage?.imageUrl || '');
}

export default function ViewProductReviewPage() {
  const router = useRouter();
  const params = useParams();
  const productUuid = params?.productUuid;
  const reviewUuid = params?.reviewUuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [product, setProduct] = useState(null);
  const [review, setReview] = useState(null);

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
      } catch (err) {
        setError(err.message || 'Failed to load review.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [apiFetch, productUuid, reviewUuid, token]);

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
                  <h4 className="card-title mb-0">View Product Review</h4>
                  <Link href={`/products/reviews?productUuid=${encodeURIComponent(productUuid || '')}`} className="btn btn-outline-primary btn-sm">
                    Back
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading review...</p> : null}

                  {!loading && review ? (
                    <>
                      <div
                        className="mb-4"
                        style={{
                          background: '#f8f9fb',
                          border: '1px solid #eef1f6',
                          borderRadius: '16px',
                          padding: '20px 24px',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '24px',
                            lineHeight: 1.35,
                            color: '#1f2937',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            marginBottom: '8px',
                          }}
                        >
                          {product?.titleEn || product?.slug || '-'}
                        </div>
                        <div
                          className="small text-muted"
                          style={{
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            marginBottom: 0,
                          }}
                        >
                          {product?.uuid || '-'}
                        </div>
                      </div>

                      {product ? (
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
                            {getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl) ? (
                              <img
                                src={getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl)}
                                alt={product.titleEn || product.slug || 'Product'}
                                style={{
                                  width: '80px',
                                  height: '80px',
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
                                  width: '80px',
                                  height: '80px',
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
                                {product.titleEn || product.slug || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                {product.slug || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                UUID: {product.uuid || '-'}
                              </div>
                              <div className="small text-muted" style={{ overflowWrap: 'anywhere' }}>
                                Procurement ID: {product.procurementId || '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="table-responsive">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr><th style={{ width: '240px' }}>Review UUID</th><td>{review?.uuid || '-'}</td></tr>
                            <tr><th>Customer Name</th><td>{review?.customer?.fullName || '-'}</td></tr>
                            <tr><th>Customer Email</th><td>{review?.customer?.emailAddress || '-'}</td></tr>
                            <tr><th>Rating</th><td>{review?.rating ?? '-'}</td></tr>
                            <tr><th>Comment</th><td style={{ whiteSpace: 'pre-wrap' }}>{review?.comment || '-'}</td></tr>
                            <tr><th>Edited</th><td>{review?.isEdited ? 'Yes' : 'No'}</td></tr>
                            <tr>
                              <th>Images</th>
                              <td>
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
                                    <span className="text-muted">No images</span>
                                  )}
                                  {Array.isArray(review?.images) ? (
                                    <span className="small text-muted">{review.images.length} total</span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
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
    </div>
  );
}
