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
import { BANNER_PLACEMENTS, normalizeBannerPlacement } from '@/lib/bannerPlacement';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function isValidHexColor(value) {
  return /^#([0-9A-Fa-f]{6})$/.test(String(value || '').trim());
}

function flattenCategories(categories, depth = 0, parentUuid = null) {
  if (!Array.isArray(categories)) return [];

  const rows = [];
  categories.forEach((category) => {
    rows.push({ ...category, depth, parentUuid });

    if (Array.isArray(category?.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, depth + 1, category?.uuid || null));
    }
  });

  return rows;
}

function extractBannerCategoryUuids(banner) {
  if (Array.isArray(banner?.bannerCategories)) {
    return banner.bannerCategories
      .map((item) => item?.category?.uuid || item?.uuid || '')
      .filter(Boolean);
  }

  if (Array.isArray(banner?.categories)) {
    return banner.categories
      .map((item) => (typeof item === 'string' ? item : item?.uuid || ''))
      .filter(Boolean);
  }

  return [];
}

function isSingleCategoryPlacement(value) {
  return normalizeBannerPlacement(value) === 'single-category';
}

export default function EditBannerPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrlEn, setImageUrlEn] = useState('');
  const [imageUrlAr, setImageUrlAr] = useState('');
  const [colorTouched, setColorTouched] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [formData, setFormData] = useState({
    titleEn: '',
    titleAr: '',
    linkUrlEn: '',
    linkUrlAr: '',
    placement: 'homepage',
    color: '#000000',
    isActive: true,
    categories: [],
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
        const backendError = payload?.errors?.error || mergedMessage || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !uuid) return;

    const loadBanner = async () => {
      setLoading(true);
      setError('');
      try {
        const banner = await apiFetch(`/api/banners/${uuid}`, { method: 'GET' });
        setImageUrlEn(banner?.imageUrlEn || banner?.imageUrl || '');
        setImageUrlAr(banner?.imageUrlAr || '');
        setFormData({
          titleEn: banner?.titleEn || '',
          titleAr: banner?.titleAr || '',
          linkUrlEn: banner?.linkUrlEn || banner?.linkUrl || '',
          linkUrlAr: banner?.linkUrlAr || banner?.linkUrl || '',
          placement: normalizeBannerPlacement(banner?.placement) || 'homepage',
          color: banner?.color || '#000000',
          isActive: Boolean(banner?.isActive),
          categories: extractBannerCategoryUuids(banner),
        });
      } catch (err) {
        setError(err.message || 'Failed to load banner.');
      } finally {
        setLoading(false);
      }
    };

    loadBanner();
  }, [apiFetch, token, uuid]);

  useEffect(() => {
    if (!token) return;

    const loadCategories = async () => {
      try {
        const params = new URLSearchParams();
        params.set('pageNumber', '1');
        params.set('itemsPerPage', '500');
        setLoadingCategories(true);
        const data = await apiFetch(`/api/categories?${params.toString()}`, { method: 'GET' });
        setCategoryOptions(flattenCategories(Array.isArray(data) ? data : []));
      } catch {
        setCategoryOptions([]);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [apiFetch, token]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const categoryByUuid = useMemo(() => {
    return new Map(categoryOptions.map((category) => [category.uuid, category]));
  }, [categoryOptions]);

  const onToggleCategory = (categoryUUID, checked) => {
    setFormData((prev) => {
      const selectedCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const exists = selectedCategories.includes(categoryUUID);

      if (checked && !exists) {
        const nextCategories = new Set(selectedCategories);
        let currentUuid = categoryUUID;

        while (currentUuid) {
          nextCategories.add(currentUuid);
          const currentCategory = categoryByUuid.get(currentUuid);
          currentUuid = currentCategory?.parentUuid || null;
        }

        return { ...prev, categories: Array.from(nextCategories) };
      }
      if (!checked && exists) {
        return { ...prev, categories: selectedCategories.filter((item) => item !== categoryUUID) };
      }
      return prev;
    });
  };

  const onPlacementChange = (event) => {
    const { value } = event.target;
    const normalizedPlacement = normalizeBannerPlacement(value);
    setFormData((prev) => ({ ...prev, placement: normalizedPlacement }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setColorTouched(true);

    if (!formData.color.trim()) {
      setError('Color and Placement are required.');
      return;
    }

    const normalizedPlacement = normalizeBannerPlacement(formData.placement);
    if (!normalizedPlacement) {
      setError('Please select a valid placement.');
      return;
    }

    if (!isValidHexColor(formData.color)) {
      setError('Please provide a valid color hex code (example: #A1B2C3).');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/banners/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: {
            en: String(formData.titleEn ?? '').trim(),
            ar: String(formData.titleAr ?? '').trim(),
          },
          linkUrl: {
            en: String(formData.linkUrlEn ?? '').trim(),
            ar: String(formData.linkUrlAr ?? '').trim(),
          },
          categories: Array.isArray(formData.categories) ? formData.categories : [],
          placement: normalizedPlacement,
          color: formData.color.trim(),
          isActive: formData.isActive,
        }),
      });
      setMessage('Banner updated.');
    } catch (err) {
      setError(err.message || 'Failed to update banner.');
    } finally {
      setSubmitting(false);
    }
  };

  const showColorError = colorTouched && !isValidHexColor(formData.color);
  const pickerColor = isValidHexColor(formData.color) ? formData.color : '#000000';
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
    () => categoryOptions.filter((category) => formData.categories.includes(category.uuid)),
    [categoryOptions, formData.categories]
  );

  if (!isValid) {
    return <div className="screen-center">Loading banner form...</div>;
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
                  <h4 className="card-title mb-0">Edit Banner</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/banners/${uuid}`} className="btn btn-outline-dark btn-sm">
                      View Banner
                    </Link>
                    <Link href="/banners" className="btn btn-outline-primary btn-sm">
                      Back to Banners
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  {loading ? <p className="mb-0">Loading banner...</p> : null}

                  {!loading ? (
                    <form onSubmit={onSubmit}>
                      {imageUrlEn || imageUrlAr ? (
                        <div className="row mb-3">
                          {imageUrlEn ? (
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Current Image (English)</label>
                              <div>
                                <img
                                  src={getTransformedImageUrl(imageUrlEn)}
                                  alt="Banner English"
                                  style={{ width: '320px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #eee' }}
                                />
                              </div>
                            </div>
                          ) : null}
                          {imageUrlAr ? (
                            <div className="col-md-6 mb-2">
                              <label className="form-label">Current Image (Arabic)</label>
                              <div>
                                <img
                                  src={getTransformedImageUrl(imageUrlAr)}
                                  alt="Banner Arabic"
                                  style={{ width: '320px', maxWidth: '100%', borderRadius: '8px', border: '1px solid #eee' }}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="row">
                        <div className="col-lg-8">
                          <div className="row">
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Title (English)</label>
                              <input className="form-control" name="titleEn" value={formData.titleEn} onChange={onChange} />
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Title (Arabic)</label>
                              <input className="form-control" name="titleAr" value={formData.titleAr} onChange={onChange} />
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Link URL (English)</label>
                              <input className="form-control" name="linkUrlEn" value={formData.linkUrlEn} onChange={onChange} />
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Link URL (Arabic)</label>
                              <input className="form-control" name="linkUrlAr" value={formData.linkUrlAr} onChange={onChange} />
                            </div>
                            <div className="col-md-4 mb-3">
                              <label className="form-label">Placement *</label>
                              <select
                                className="form-control"
                                name="placement"
                                value={formData.placement}
                                onChange={onPlacementChange}
                                required
                              >
                                {BANNER_PLACEMENTS.map((placement) => (
                                  <option key={placement} value={placement}>
                                    {placement === 'homepage'
                                      ? 'Homepage'
                                      : placement === 'Hotdeals_Web'
                                        ? 'Hotdeals Web'
                                        : placement === 'Hotdeals_Mobile'
                                          ? 'Hotdeals Mobile'
                                          : placement === 'all-categories'
                                            ? 'All Categories'
                                            : placement === 'all-categories-mobile'
                                              ? 'All Categories / Mobile'
                                            : 'Single Category'}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-4 mb-3">
                              <label className="form-label">Color *</label>
                              <input
                                className="form-control"
                                type="color"
                                name="color"
                                value={pickerColor}
                                onChange={onChange}
                                onBlur={() => setColorTouched(true)}
                                required
                              />
                            </div>
                            <div className="col-md-8 mb-3">
                              <label className="form-label">Color Value</label>
                              <input
                                className={`form-control${showColorError ? ' is-invalid' : ''}`}
                                name="color"
                                value={formData.color}
                                onChange={onChange}
                                onBlur={() => setColorTouched(true)}
                                required
                              />
                              {showColorError ? (
                                <div className="invalid-feedback">This color is invalid. Use a valid hex value like #000000.</div>
                              ) : null}
                            </div>
                            <div className="col-md-12 mb-3">
                              <div className="form-check">
                                <input
                                  id="isActive"
                                  className="form-check-input"
                                  type="checkbox"
                                  name="isActive"
                                  checked={formData.isActive}
                                  onChange={onChange}
                                />
                                <label className="form-check-label" htmlFor="isActive">
                                  Active
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {isSingleCategoryPlacement(formData.placement) ? (
                          <div className="col-lg-4 mb-3">
                            <div className="card h-100">
                              <div className="card-body">
                                <label className="form-label">Selected Categories</label>
                                <div className="mb-3">
                                  {selectedCategoryDetails.length > 0 ? (
                                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                      {selectedCategoryDetails.map((category) => (
                                        <span
                                          key={`selected-${category.uuid}`}
                                          className="badge badge-light border text-dark"
                                          style={{ whiteSpace: 'normal', lineHeight: 1.4 }}
                                        >
                                          {category.slug && category.slug !== (category.nameEn || category.name || category.slug)
                                            ? `${category.nameEn || category.name || category.slug} (${category.slug})`
                                            : category.nameEn || category.name || category.slug}
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
                                          id={`banner-cat-${category.uuid}`}
                                          className="form-check-input"
                                          type="checkbox"
                                          checked={formData.categories.includes(category.uuid)}
                                          onChange={(e) => onToggleCategory(category.uuid, e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor={`banner-cat-${category.uuid}`}>
                                          {category.nameEn || category.name || category.slug}
                                        </label>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting || showColorError}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/banners/${uuid}`} className="btn btn-light">
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
  );
}
