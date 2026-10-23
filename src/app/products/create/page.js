'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';

const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false });

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

function toLocalizedText(enValue) {
  const value = String(enValue || '').trim();
  return { en: value, ar: value };
}

export default function CreateProductPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [formData, setFormData] = useState({
    slug: '',
    titleEn: '',
    briefEn: '',
    descriptionEn: '',
    descriptionHtmlEn: '',
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
        throw toApiError(payload, response, 'Request failed.');
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;

    const loadCategories = async () => {
      setLoadingCategories(true);
      setError('');
      try {
        const data = await apiFetch('/api/categories', { method: 'GET' });
        setCategoryOptions(flattenCategories(Array.isArray(data) ? data : []));
      } catch (err) {
        setError(err.message || 'Failed to load categories.');
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [apiFetch, token]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const onToggleCategory = (categoryUUID, checked) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(categoryUUID);
      if (checked && !exists) return [...prev, categoryUUID];
      if (!checked && exists) return prev.filter((item) => item !== categoryUUID);
      return prev;
    });
  };

  const filteredCategoryOptions = useMemo(() => {
    const query = String(categorySearch || '').trim().toLowerCase();
    if (!query) return categoryOptions;
    return categoryOptions.filter((category) => {
      const name = String(category?.nameEn || category?.name || '').toLowerCase();
      const slug = String(category?.slug || '').toLowerCase();
      return name.includes(query) || slug.includes(query);
    });
  }, [categoryOptions, categorySearch]);

  const selectedCategoryDetails = useMemo(
    () => categoryOptions.filter((category) => selectedCategories.includes(category.uuid)),
    [categoryOptions, selectedCategories]
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (
      !formData.slug.trim() ||
      !formData.titleEn.trim() ||
      !formData.briefEn.trim() ||
      !formData.descriptionEn.trim() ||
      !formData.descriptionHtmlEn.trim()
    ) {
      setError('Slug, title, brief, description and HTML description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          slug: formData.slug.trim(),
          title: toLocalizedText(formData.titleEn),
          brief: toLocalizedText(formData.briefEn),
          description: toLocalizedText(formData.descriptionEn),
          descriptionHtml: toLocalizedText(formData.descriptionHtmlEn),
          categories: selectedCategories,
        }),
      });
      router.push('/products');
    } catch (err) {
      setFieldErrors(err?.fieldErrors || {});
      setError(err.message || 'Failed to create product.');
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (...keys) => {
    for (const key of keys) {
      const value = fieldErrors?.[key];
      if (value) return value;
    }
    return '';
  };

  useEffect(() => {
    const hasErrors = Object.keys(fieldErrors || {}).length > 0;
    if (!hasErrors) return;

    const firstInvalid = document.querySelector('.is-invalid');
    if (!firstInvalid) return;

    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (typeof firstInvalid.focus === 'function') {
      firstInvalid.focus({ preventScroll: true });
    }
  }, [fieldErrors]);

  if (!isValid) {
    return <div className="screen-center">Loading product form...</div>;
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
                  <h4 className="card-title mb-0">Create Product</h4>
                  <Link href="/products" className="btn btn-outline-primary btn-sm">
                    Back to Products
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="row">
                      <div className="col-lg-8">
                        <div className="row">
                          <div className="col-md-12 mb-3">
                            <label className="form-label">Slug</label>
                            <input
                              className={`form-control${getFieldError('slug') ? ' is-invalid' : ''}`}
                              name="slug"
                              value={formData.slug}
                              onChange={onChange}
                              maxLength={64}
                              required
                            />
                            {getFieldError('slug') ? <span className="text-danger small">{getFieldError('slug')}</span> : null}
                          </div>

                          <div className="col-md-12 mb-3">
                            <label className="form-label">Title (English)</label>
                            <input
                              className={`form-control${getFieldError('titleEn', 'title.en', 'title') ? ' is-invalid' : ''}`}
                              name="titleEn"
                              value={formData.titleEn}
                              onChange={onChange}
                              maxLength={128}
                              required
                            />
                            {getFieldError('titleEn', 'title.en', 'title') ? (
                              <span className="text-danger small">{getFieldError('titleEn', 'title.en', 'title')}</span>
                            ) : null}
                          </div>

                          <div className="col-md-12 mb-3">
                            <label className="form-label">Brief (English)</label>
                            <textarea
                              className={`form-control${getFieldError('briefEn', 'brief.en', 'brief') ? ' is-invalid' : ''}`}
                              name="briefEn"
                              value={formData.briefEn}
                              onChange={onChange}
                              maxLength={256}
                              rows={3}
                            />
                            {getFieldError('briefEn', 'brief.en', 'brief') ? (
                              <span className="text-danger small">{getFieldError('briefEn', 'brief.en', 'brief')}</span>
                            ) : null}
                          </div>

                          <div className="col-md-12 mb-3">
                            <label className="form-label">Description (English)</label>
                            <textarea
                              className={`form-control${getFieldError('descriptionEn', 'description.en', 'description') ? ' is-invalid' : ''}`}
                              name="descriptionEn"
                              value={formData.descriptionEn}
                              onChange={onChange}
                              maxLength={1024}
                              rows={4}
                            />
                            {getFieldError('descriptionEn', 'description.en', 'description') ? (
                              <span className="text-danger small">{getFieldError('descriptionEn', 'description.en', 'description')}</span>
                            ) : null}
                          </div>

                          <div className="col-md-12 mb-3">
                            <RichTextEditor
                              label="Description HTML (English)"
                              value={formData.descriptionHtmlEn}
                              onChange={(nextHtml) => {
                                setFormData((prev) => ({ ...prev, descriptionHtmlEn: nextHtml }));
                                setFieldErrors((prev) => {
                                  const next = { ...prev };
                                  delete next.descriptionHtmlEn;
                                  delete next['descriptionHtml.en'];
                                  delete next.descriptionHtml;
                                  return next;
                                });
                              }}
                            />
                            {getFieldError('descriptionHtmlEn', 'descriptionHtml.en', 'descriptionHtml') ? (
                              <span className="text-danger small">
                                {getFieldError('descriptionHtmlEn', 'descriptionHtml.en', 'descriptionHtml')}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="col-lg-4 mb-3">
                        <div className="card h-100">
                          <div className="card-body">
                            <label className="form-label">Selected Categories</label>
                            <div className="mb-3">
                              {selectedCategoryDetails.length > 0 ? (
                                <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                  {selectedCategoryDetails.map((category) => (
                                    <span key={`selected-${category.uuid}`} className="badge badge-light border text-dark">
                                      {category.nameEn || category.name || category.slug}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <small className="text-muted">No categories selected.</small>
                              )}
                            </div>

                            <label className="form-label">Search Categories</label>
                            <input
                              className="form-control mb-3"
                              placeholder="Search category..."
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                              disabled={loadingCategories}
                            />

                            <div
                              className="border rounded p-2"
                              style={{ maxHeight: '420px', overflowY: 'auto', background: '#fff' }}
                            >
                              {loadingCategories ? (
                                <small className="text-muted">Loading categories...</small>
                              ) : filteredCategoryOptions.length === 0 ? (
                                <small className="text-muted">No categories found.</small>
                              ) : (
                                filteredCategoryOptions.map((category) => (
                                  <div
                                    key={category.uuid}
                                    className="form-check mb-2"
                                    style={{ paddingLeft: `${12 + category.depth * 18}px` }}
                                  >
                                    <input
                                      id={`create-cat-${category.uuid}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={selectedCategories.includes(category.uuid)}
                                      onChange={(e) => {
                                        onToggleCategory(category.uuid, e.target.checked);
                                        setFieldErrors((prev) => {
                                          const next = { ...prev };
                                          delete next.categories;
                                          return next;
                                        });
                                      }}
                                    />
                                    <label className="form-check-label" htmlFor={`create-cat-${category.uuid}`}>
                                      {category.nameEn || category.name || category.slug}
                                    </label>
                                  </div>
                                ))
                              )}
                            </div>
                            {getFieldError('categories') ? (
                              <span className="text-danger small d-block mt-2">{getFieldError('categories')}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create Product'}
                      </button>
                      <Link href="/products" className="btn btn-light">
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
