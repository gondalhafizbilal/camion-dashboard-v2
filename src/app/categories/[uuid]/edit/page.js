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

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [formData, setFormData] = useState({
    slug: '',
    nameEn: '',
    nameAr: '',
    pricingFactor: '1',
    discountPercentage: '0',
    isFeatured: false,
    isFeaturedOnHomepage: false,
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
        const backendError = payload?.errors?.error || payload?.errors?.slug || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !uuid) return;

    const loadCategory = async () => {
      setLoading(true);
      setError('');
      try {
        const category = await apiFetch(`/api/categories/${uuid}`, { method: 'GET' });
        setFormData({
          slug: category?.slug || '',
          nameEn: category?.nameEn || category?.name || '',
          nameAr: category?.nameAr || '',
          pricingFactor: category?.pricingFactor !== undefined && category?.pricingFactor !== null
            ? String(category.pricingFactor)
            : '1',
          discountPercentage: category?.discountPercentage !== undefined && category?.discountPercentage !== null
            ? String(category.discountPercentage)
            : '0',
          isFeatured: Boolean(category?.isFeatured),
          isFeaturedOnHomepage: Boolean(category?.isFeaturedOnHomepage),
        });
        setThumbnailUrl(category?.thumbnailUrl || '');
      } catch (err) {
        setError(err.message || 'Failed to load category.');
      } finally {
        setLoading(false);
      }
    };

    loadCategory();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const pricingFactorNumber = Number(formData.pricingFactor);
    const discountPercentageNumber = Number(formData.discountPercentage);
    if (!formData.slug.trim() || !formData.nameEn.trim() || !formData.nameAr.trim()) {
      setError('Slug, English name and Arabic name are required.');
      return;
    }

    if (Number.isNaN(pricingFactorNumber) || pricingFactorNumber < 0) {
      setError('Pricing factor must be a number greater than or equal to 0.');
      return;
    }
    if (Number.isNaN(discountPercentageNumber) || discountPercentageNumber < 0) {
      setError('Discount percentage must be a number greater than or equal to 0.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch(`/api/categories/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          slug: formData.slug.trim(),
          name: {
            en: formData.nameEn.trim(),
            ar: formData.nameAr.trim(),
          },
          pricingFactor: pricingFactorNumber,
          discountPercentage: discountPercentageNumber,
          isFeatured: Boolean(formData.isFeatured),
          isFeaturedOnHomepage: Boolean(formData.isFeaturedOnHomepage),
        }),
      });

      setMessage('Category updated.');
      router.push(`/categories/${uuid}`);
    } catch (err) {
      setError(err.message || 'Failed to update category.');
    } finally {
      setSubmitting(false);
    }
  };

  const onUploadThumbnail = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!thumbnailFile) {
      setError('Please select an image file first.');
      return;
    }

    setUploadingThumbnail(true);
    try {
      const body = new FormData();
      body.append('file', thumbnailFile);
      const updated = await apiFetch(`/api/categories/${uuid}/thumbnail`, {
        method: 'PUT',
        body,
      });
      setThumbnailUrl(updated?.thumbnailUrl || '');
      setThumbnailFile(null);
      setMessage('Thumbnail updated.');
    } catch (err) {
      setError(err.message || 'Failed to upload thumbnail.');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading category form...</div>;
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
                  <h4 className="card-title mb-0">Edit Category</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/categories/${uuid}`} className="btn btn-outline-dark btn-sm">
                      View
                    </Link>
                    <Link href="/categories" className="btn btn-outline-primary btn-sm">
                      Back to Categories
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  {loading ? <p className="mb-0">Loading category...</p> : null}

                  {!loading ? (
                    <>
                      <form onSubmit={onUploadThumbnail} className="mb-4">
                        <div className="row">
                          <div className="col-md-12 mb-2">
                            <label className="form-label">Category Image</label>
                          </div>
                          {thumbnailUrl ? (
                            <div className="col-md-12 mb-3">
                              <img
                                src={getTransformedImageUrl(thumbnailUrl)}
                                alt="Category thumbnail"
                                style={{
                                  width: '180px',
                                  height: '180px',
                                  objectFit: 'contain',
                                  borderRadius: '8px',
                                  border: '1px solid #e6e6e6',
                                  background: '#fff',
                                  padding: '8px',
                                }}
                              />
                            </div>
                          ) : null}
                          <div className="col-md-8 mb-3">
                            <input
                              className="form-control"
                              type="file"
                              accept="image/*"
                              onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)}
                            />
                          </div>
                          <div className="col-md-4 mb-3 d-flex align-items-center">
                            <button className="btn btn-outline-primary w-100" type="submit" disabled={uploadingThumbnail}>
                              {uploadingThumbnail ? 'Uploading...' : 'Upload Thumbnail'}
                            </button>
                          </div>
                        </div>
                      </form>

                      <form onSubmit={onSubmit}>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Slug</label>
                          <input
                            className="form-control"
                            name="slug"
                            value={formData.slug}
                            onChange={onChange}
                            maxLength={64}
                            required
                          />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Pricing Factor</label>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            step="0.01"
                            name="pricingFactor"
                            value={formData.pricingFactor}
                            onChange={onChange}
                            required
                          />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Discount Percentage</label>
                          <input
                            className="form-control"
                            type="number"
                            min="0"
                            step="0.01"
                            name="discountPercentage"
                            value={formData.discountPercentage}
                            onChange={onChange}
                            required
                          />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Name (English)</label>
                          <input
                            className="form-control"
                            name="nameEn"
                            value={formData.nameEn}
                            onChange={onChange}
                            maxLength={32}
                            required
                          />
                        </div>

                        <div className="col-md-6 mb-3">
                          <label className="form-label">Name (Arabic)</label>
                          <input
                            className="form-control"
                            name="nameAr"
                            value={formData.nameAr}
                            onChange={onChange}
                            maxLength={32}
                            required
                          />
                        </div>

                        

                        <div className="col-md-12 mb-3">
                        <div className="form-check">
                            <input
                              id="isFeatured"
                              className="form-check-input"
                              type="checkbox"
                              name="isFeatured"
                              checked={formData.isFeatured}
                              onChange={onChange}
                            />
                            <label className="form-check-label" htmlFor="isFeatured">
                              Featured Category
                            </label>
                          </div>
                          <div className="form-check">
                            <input
                              id="isFeaturedOnHomepage"
                              className="form-check-input"
                              type="checkbox"
                              name="isFeaturedOnHomepage"
                              checked={formData.isFeaturedOnHomepage}
                              onChange={onChange}
                            />
                            <label className="form-check-label" htmlFor="isFeaturedOnHomepage">
                              Featured On Homepage <small>(it will replace the existing home featured category)</small>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/categories/${uuid}`} className="btn btn-light">
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
