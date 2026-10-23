'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function flattenCategories(categories, depth = 0) {
  if (!Array.isArray(categories)) return [];

  const rows = [];
  categories.forEach((category) => {
    rows.push({ ...category, depth });
    if (Array.isArray(category.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, depth + 1));
    }
  });

  return rows;
}

export default function CreateCategoryPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingParents, setLoadingParents] = useState(true);
  const [error, setError] = useState('');
  const [parentOptions, setParentOptions] = useState([]);
  const [formData, setFormData] = useState({
    parentUUID: '',
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

      if (options.body !== undefined && !headers.has('Content-Type')) {
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
    if (!token) return;

    const loadParents = async () => {
      setLoadingParents(true);
      setError('');
      try {
        const data = await apiFetch('/api/categories', { method: 'GET' });
        setParentOptions(flattenCategories(Array.isArray(data) ? data : []));
      } catch (err) {
        setError(err.message || 'Failed to load categories.');
      } finally {
        setLoadingParents(false);
      }
    };

    loadParents();
  }, [apiFetch, token]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

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
      await apiFetch('/api/categories', {
        method: 'POST',
        body: JSON.stringify({
          parentUUID: formData.parentUUID || null,
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

      router.push('/categories');
    } catch (err) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setSubmitting(false);
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
                  <h4 className="card-title mb-0">Create Category</h4>
                  <Link href="/categories" className="btn btn-outline-primary btn-sm">
                    Back to Categories
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

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

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Parent Category (Optional)</label>
                        <select
                          className="form-control"
                          name="parentUUID"
                          value={formData.parentUUID}
                          onChange={onChange}
                          disabled={loadingParents}
                        >
                          <option value="">No Parent (Root Category)</option>
                          {parentOptions.map((category) => (
                            <option key={category.uuid} value={category.uuid}>
                              {`${'— '.repeat(category.depth)}${category.name || category.slug}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-md-12 mb-3">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="isFeatured"
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
                            className="form-check-input"
                            type="checkbox"
                            id="isFeaturedOnHomepage"
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
                        {submitting ? 'Creating...' : 'Create Category'}
                      </button>
                      <Link href="/categories" className="btn btn-light">
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
