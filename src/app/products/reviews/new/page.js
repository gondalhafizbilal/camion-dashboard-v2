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

function normalizeReviewErrors(payload) {
  const source = payload?.errors || {};
  return {
    emailAddress: source?.emailAddress || '',
    rating: source?.rating || '',
    comment: source?.comment || '',
  };
}

function shouldHideSearch(selectedProduct, initialProductUuid) {
  return Boolean(selectedProduct?.uuid || initialProductUuid);
}

export default function NewProductReviewPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [initialProductUuid, setInitialProductUuid] = useState('');
  const [returnTo, setReturnTo] = useState('/products/reviews');
  const [formData, setFormData] = useState({
    emailAddress: '',
    rating: '5',
    comment: '',
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

  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    setInitialProductUuid(String(params.get('productUuid') || '').trim());
    const initialEmailAddress = String(params.get('emailAddress') || '').trim();
    const nextReturnTo = String(params.get('returnTo') || '').trim();
    if (nextReturnTo) {
      setReturnTo(nextReturnTo);
    }
    if (initialEmailAddress) {
      setFormData((prev) => ({ ...prev, emailAddress: initialEmailAddress }));
    }
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

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setFieldErrors({});

    if (!selectedProduct?.uuid) {
      setError('Please select a product.');
      return;
    }

    if (!formData.emailAddress.trim() || !formData.comment.trim() || !formData.rating) {
      setError('Email address, rating, and comment are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/products/${encodeURIComponent(selectedProduct.uuid)}/reviews/genuine`, {
        method: 'POST',
        body: JSON.stringify({
          emailAddress: formData.emailAddress.trim(),
          rating: Number(formData.rating),
          comment: formData.comment.trim(),
        }),
      });
      setMessage('Review created successfully. Redirecting...');
      window.setTimeout(() => {
        router.push(returnTo || '/products');
      }, 1200);
    } catch (err) {
      setFieldErrors(normalizeReviewErrors(err?.payload || {}));
      setError(err.message || 'Failed to create genuine review.');
    } finally {
      setSubmitting(false);
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
                  <h4 className="card-title mb-0">Create Product Review</h4>
                  <Link href={returnTo || '/products'} className="btn btn-outline-primary btn-sm">
                    Back
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  <form onSubmit={onSubmit}>
                    <div className="mb-4">
                      <ProductAjaxSearchSelect
                        apiFetch={apiFetch}
                        selectedProductUuid={selectedProduct?.uuid || initialProductUuid}
                        selectedProduct={selectedProduct}
                        onSelectProduct={setSelectedProduct}
                        label="Product"
                        hideSearch={shouldHideSearch(selectedProduct, initialProductUuid)}
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

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Customer Email</label>
                        <input
                          className={`form-control${fieldErrors.emailAddress ? ' is-invalid' : ''}`}
                          name="emailAddress"
                          value={formData.emailAddress}
                          onChange={onChange}
                          required
                        />
                        {fieldErrors.emailAddress ? <div className="invalid-feedback">{fieldErrors.emailAddress}</div> : null}
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Rating</label>
                        <select
                          className={`form-control${fieldErrors.rating ? ' is-invalid' : ''}`}
                          name="rating"
                          value={formData.rating}
                          onChange={onChange}
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
                          name="comment"
                          value={formData.comment}
                          onChange={onChange}
                          rows={6}
                          maxLength={512}
                          required
                        />
                        {fieldErrors.comment ? <div className="invalid-feedback">{fieldErrors.comment}</div> : null}
                      </div>
                    </div>

                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Review'}
                      </button>
                      <Link href={returnTo || '/products'} className="btn btn-light">
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
