'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';
import { getTransformedImageUrl } from '@/lib/imageUrl';

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

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingSizechart, setUploadingSizechart] = useState(false);
  const [deletingSizechart, setDeletingSizechart] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentUUID, setDeletingAttachmentUUID] = useState('');
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [product, setProduct] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [slugValue, setSlugValue] = useState('');
  const [statusValue, setStatusValue] = useState('draft');
  const [urgencyEnabled, setUrgencyEnabled] = useState(false);
  const [urgencyStockCount, setUrgencyStockCount] = useState('');
  const [formData, setFormData] = useState({
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

      if (options.body !== undefined && !headers.has('Content-Type') && typeof options.body === 'string') {
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

  useEffect(() => {
    if (!token || !uuid) return;

    const loadProduct = async () => {
      setLoading(true);
      setError('');

      try {
        const product = await apiFetch(`/api/products/${uuid}`, { method: 'GET' });
        setProduct(product || null);
        setFormData({
          titleEn: product?.titleEn || product?.title || '',
          briefEn: product?.briefEn || product?.brief || '',
          descriptionEn: product?.descriptionEn || product?.description || '',
          descriptionHtmlEn: product?.descriptionHtmlEn || product?.descriptionHtml || '',
        });
        setSlugValue(product?.slug || '');
        setStatusValue(String(product?.status || 'draft').toLowerCase());
        setUrgencyEnabled(Boolean(product?.urgencyEnabled));
        setUrgencyStockCount(
          product?.urgencyStockCount !== null && product?.urgencyStockCount !== undefined
            ? String(product.urgencyStockCount)
            : ''
        );

        const categoryUUIDs = Array.isArray(product?.productCategories)
          ? product.productCategories.map((item) => item?.category?.uuid).filter(Boolean)
          : [];
        setSelectedCategories(categoryUUIDs);
      } catch (err) {
        setError(err.message || 'Failed to load product.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next.stockCount;
      return next;
    });
  };

  const onToggleUrgency = (enabled) => {
    setUrgencyEnabled(enabled);
    if (!enabled) {
      setUrgencyStockCount('');
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.urgencyEnabled;
      delete next.urgencyStockCount;
      delete next.stockCount;
      return next;
    });
  };

  const onUrgencyStockCountChange = (event) => {
    setUrgencyStockCount(event.target.value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.urgencyStockCount;
      delete next.stockCount;
      return next;
    });
  };

  const onUploadSizechart = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !uuid) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploadingSizechart(true);
    setError('');
    setMessage('');
    try {
      const updatedProduct = await apiFetch(`/api/products/${uuid}/sizechart`, {
        method: 'PUT',
        body: formData,
      });
      setProduct(updatedProduct || null);
      setMessage('Product size chart updated.');
    } catch (err) {
      setError(err.message || 'Failed to update product size chart.');
    } finally {
      setUploadingSizechart(false);
    }
  };

  const onDeleteSizechart = async () => {
    if (!uuid) return;

    setDeletingSizechart(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/sizechart`, {
        method: 'DELETE',
      });
      setProduct((prev) => (prev ? { ...prev, sizechartUrl: null } : prev));
      setMessage('Product size chart deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete product size chart.');
    } finally {
      setDeletingSizechart(false);
    }
  };

  const onUploadAttachment = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0 || !uuid) return;

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    setUploadingAttachment(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const updatedProduct = await apiFetch(`/api/products/${uuid}`, { method: 'GET' });
      setProduct(updatedProduct || null);
      setMessage(files.length === 1 ? 'Product attachment uploaded.' : `${files.length} product attachments uploaded.`);
    } catch (err) {
      setError(err.message || 'Failed to upload product attachments.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const onDeleteAttachment = async (attachmentUUID) => {
    if (!uuid || !attachmentUUID) return;

    setDeletingAttachmentUUID(attachmentUUID);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/attachments/${attachmentUUID}`, {
        method: 'DELETE',
      });
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              attachments: Array.isArray(prev.attachments)
                ? prev.attachments.filter((item) => item?.uuid !== attachmentUUID)
                : [],
            }
          : prev
      );
      setMessage('Product attachment deleted.');
    } catch (err) {
      setError(err.message || 'Failed to delete product attachment.');
    } finally {
      setDeletingAttachmentUUID('');
    }
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

  const onUpdateProduct = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setFieldErrors({});

    if (
      !formData.titleEn.trim() ||
      !formData.briefEn.trim() ||
      !formData.descriptionEn.trim() ||
      !formData.descriptionHtmlEn.trim()
    ) {
      setError('Title, brief, description and HTML description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/products/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: toLocalizedText(formData.titleEn),
          brief: toLocalizedText(formData.briefEn),
          description: toLocalizedText(formData.descriptionEn),
          descriptionHtml: toLocalizedText(formData.descriptionHtmlEn),
          categories: selectedCategories,
        }),
      });

      await apiFetch(`/api/products/${uuid}/urgency`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: Boolean(urgencyEnabled),
          stockCount: urgencyEnabled ? Number(urgencyStockCount || 0) : 0,
        }),
      });

      setMessage('Product details updated.');
    } catch (err) {
      setFieldErrors(err?.fieldErrors || {});
      setError(err.message || 'Failed to update product.');
    } finally {
      setSubmitting(false);
    }
  };

  const onUpdateSlug = async () => {
    if (!slugValue.trim()) {
      setError('Slug is required.');
      return;
    }

    setSlugSaving(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      await apiFetch(`/api/products/${uuid}/slug`, {
        method: 'PUT',
        body: JSON.stringify({ slug: slugValue.trim() }),
      });
      setShowSlugModal(false);
      setMessage('Product slug updated.');
    } catch (err) {
      setFieldErrors(err?.fieldErrors || {});
      setError(err.message || 'Failed to update slug.');
    } finally {
      setSlugSaving(false);
    }
  };

  const onUpdateStatus = async () => {
    setStatusSaving(true);
    setError('');
    setMessage('');
    setFieldErrors({});
    try {
      await apiFetch(`/api/products/${uuid}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: String(statusValue).toLowerCase() }),
      });
      setShowStatusModal(false);
      setMessage('Product status updated.');
    } catch (err) {
      setFieldErrors(err?.fieldErrors || {});
      setError(err.message || 'Failed to update status.');
    } finally {
      setStatusSaving(false);
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
                    <h4 className="card-title mb-0">Edit Product</h4>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-outline-dark btn-sm" type="button" onClick={() => setShowSlugModal(true)}>
                        Update Slug
                      </button>
                      <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => setShowStatusModal(true)}>
                        Update Status
                      </button>
                      <Link href={`/products/${uuid}`} className="btn btn-outline-primary btn-sm">
                        View Product
                      </Link>
                    </div>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}
                    {loading ? <p className="mb-0">Loading product...</p> : null}

                    {!loading ? (
                      <form onSubmit={onUpdateProduct}>
                        <div className="row">
                          <div className="col-lg-8">
                            <div className="row">
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
                                <label className="form-label">Featured Image</label>
                                <div className="mb-3">
                                  {product?.featuredImageUrl || product?.featuredThumbnailUrl ? (
                                    <img
                                      src={getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl)}
                                      alt="Product featured"
                                      style={{
                                        width: '100%',
                                        maxWidth: '240px',
                                        height: '160px',
                                        objectFit: 'cover',
                                        borderRadius: '10px',
                                        border: '1px solid #eee',
                                        background: '#f6f6f6',
                                      }}
                                    />
                                  ) : (
                                    <small className="text-muted">No featured image set.</small>
                                  )}
                                </div>

                                <label className="form-label">Size Chart Image</label>
                                <div className="mb-3">
                                  {product?.sizechartUrl ? (
                                    <div>
                                      <img
                                        src={getTransformedImageUrl(product.sizechartUrl)}
                                        alt="Product size chart"
                                        style={{
                                          width: '100%',
                                          maxWidth: '240px',
                                          height: '160px',
                                          objectFit: 'contain',
                                          borderRadius: '10px',
                                          border: '1px solid #eee',
                                          background: '#fff',
                                        }}
                                      />
                                      <div className="d-flex flex-wrap mt-2" style={{ gap: '8px' }}>
                                        <label className="btn btn-sm btn-outline-primary mb-0">
                                          {uploadingSizechart ? 'Uploading...' : 'Replace'}
                                          <input
                                            type="file"
                                            accept="image/*"
                                            hidden
                                            disabled={uploadingSizechart || deletingSizechart}
                                            onChange={onUploadSizechart}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={onDeleteSizechart}
                                          disabled={uploadingSizechart || deletingSizechart}
                                        >
                                          {deletingSizechart ? 'Deleting...' : 'Delete'}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <small className="text-muted d-block mb-2">No size chart image uploaded.</small>
                                      <label className="btn btn-sm btn-outline-primary mb-0">
                                        {uploadingSizechart ? 'Uploading...' : 'Upload Size Chart'}
                                        <input
                                          type="file"
                                          accept="image/*"
                                          hidden
                                          disabled={uploadingSizechart || deletingSizechart}
                                          onChange={onUploadSizechart}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>

                                <label className="form-label">Gallery</label>
                                <div className="mb-3">
                                  <div className="d-flex flex-wrap mb-2" style={{ gap: '12px' }}>
                                    {Array.isArray(product?.attachments) && product.attachments.length > 0 ? (
                                      product.attachments.map((attachment) => {
                                        const isImage = String(attachment?.mediaType || '').toLowerCase() === 'image';
                                        const attachmentUrl = getTransformedImageUrl(attachment?.mediaUrl || '');
                                        return (
                                          <div
                                            key={attachment?.uuid || attachment?.mediaUrl || 'attachment'}
                                            className="border rounded p-0 position-relative"
                                            style={{ width: '112px', background: '#fff' }}
                                          >
                                            <button
                                              type="button"
                                              className="btn btn-danger btn-xs d-flex align-items-center justify-content-center"
                                              onClick={() => onDeleteAttachment(attachment?.uuid)}
                                              disabled={uploadingAttachment || deletingAttachmentUUID === attachment?.uuid}
                                              style={{
                                                position: 'absolute',
                                                top: '-8px',
                                                right: '-8px',
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '999px',
                                                padding: 0,
                                                lineHeight: 1,
                                                zIndex: 2,
                                              }}
                                              aria-label="Delete attachment"
                                            >
                                              {deletingAttachmentUUID === attachment?.uuid ? '...' : '×'}
                                            </button>
                                            <div
                                              className="d-flex align-items-center justify-content-center"
                                              style={{ width: '100%', height: '80px', background: '#f8f8f8', borderRadius: '8px', overflow: 'hidden', cursor: isImage ? 'zoom-in' : 'default' }}
                                              onClick={() => {
                                                if (isImage && attachmentUrl) {
                                                  setGalleryPreviewUrl(attachmentUrl);
                                                }
                                              }}
                                            >
                                              {isImage && attachment?.mediaUrl ? (
                                                <img
                                                  src={attachmentUrl}
                                                  alt="Product attachment"
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                              ) : (
                                                <small className="text-muted text-center px-2">File</small>
                                              )}
                                            </div>
                                            
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <small className="text-muted">No attachments uploaded.</small>
                                    )}
                                  </div>
                                  <label className="btn btn-sm btn-outline-primary mb-0">
                                    {uploadingAttachment ? 'Uploading...' : 'Upload Attachments'}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      hidden
                                      disabled={uploadingAttachment || Boolean(deletingAttachmentUUID)}
                                      onChange={onUploadAttachment}
                                    />
                                  </label>
                                </div>

                                <label className="form-label">Urgency</label>
                                <div className="border rounded p-3 bg-light mb-3">
                                  <div className="form-check mb-3">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id="productUrgencyEnabled"
                                      checked={urgencyEnabled}
                                      onChange={(event) => onToggleUrgency(event.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor="productUrgencyEnabled">
                                      Enable manual urgency override
                                    </label>
                                  </div>

                                  {urgencyEnabled ? (
                                    <div className="mb-3">
                                      <label className="form-label">Stock Count</label>
                                      <input
                                        className={`form-control${getFieldError('urgencyStockCount', 'stockCount') ? ' is-invalid' : ''}`}
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={urgencyStockCount}
                                        onChange={onUrgencyStockCountChange}
                                        placeholder="Exact fake stock count"
                                      />
                                      {getFieldError('urgencyStockCount', 'stockCount') ? (
                                        <span className="text-danger small">{getFieldError('urgencyStockCount', 'stockCount')}</span>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <div className="small text-muted">
                                    Resolved stock count: <strong>{product?.stockCount ?? 'N/A'}</strong>
                                  </div>
                                  <div className="small text-muted">
                                    Manual override: <strong>{product?.urgencyStockCount ?? 'N/A'}</strong>
                                  </div>
                                </div>

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
                                          id={`edit-cat-${category.uuid}`}
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
                                        <label className="form-check-label" htmlFor={`edit-cat-${category.uuid}`}>
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

      {galleryPreviewUrl ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Gallery Preview</h5>
                  <button type="button" className="close" onClick={() => setGalleryPreviewUrl('')}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body text-center">
                  <img
                    src={galleryPreviewUrl}
                    alt="Gallery preview"
                    style={{ maxWidth: '100%', maxHeight: '70vh', width: 'auto', height: 'auto', borderRadius: '10px' }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setGalleryPreviewUrl('')} />
        </>
      ) : null}
                          </div>
                        </div>

                        <div className="d-flex" style={{ gap: '8px' }}>
                          <button className="btn btn-primary" type="submit" disabled={submitting}>
                            {submitting ? 'Saving...' : 'Save Changes'}
                          </button>
                          <Link href={`/products/${uuid}`} className="btn btn-light">
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

      {showSlugModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Product Slug</h5>
                  <button type="button" className="close" onClick={() => setShowSlugModal(false)} disabled={slugSaving}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Slug</label>
                  <input
                    className={`form-control${getFieldError('slug') ? ' is-invalid' : ''}`}
                    value={slugValue}
                    onChange={(e) => {
                      setSlugValue(e.target.value);
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.slug;
                        return next;
                      });
                    }}
                  />
                  {getFieldError('slug') ? <span className="text-danger small">{getFieldError('slug')}</span> : null}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowSlugModal(false)} disabled={slugSaving}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdateSlug} disabled={slugSaving}>
                    {slugSaving ? 'Saving...' : 'Save Slug'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showStatusModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Product Status</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowStatusModal(false)}
                    disabled={statusSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <label className="form-label">Status</label>
                  <select
                    className={`form-control${getFieldError('status') ? ' is-invalid' : ''}`}
                    value={statusValue}
                    onChange={(e) => {
                      setStatusValue(e.target.value);
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.status;
                        return next;
                      });
                    }}
                  >
                    <option value="draft">DRAFT</option>
                    <option value="active">ACTIVE</option>
                    <option value="archived">ARCHIVED</option>
                  </select>
                  {getFieldError('status') ? <span className="text-danger small">{getFieldError('status')}</span> : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    disabled={statusSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onUpdateStatus} disabled={statusSaving}>
                    {statusSaving ? 'Saving...' : 'Save Status'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </>
  );
}
