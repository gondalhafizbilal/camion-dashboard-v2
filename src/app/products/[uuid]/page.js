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

const EMPTY_OPTION_FORM = { name: '', position: '0' };
const EMPTY_VALUE_FORM = { value: '', position: '0' };
const EMPTY_VARIANT_FORM = {
  titleEn: '',
  titleAr: '',
  sku: '',
  quantity: '0',
  barcode: '',
  priceAmount: '0',
  priceCurrencyCode: 'qar',
  weightAmount: '0',
  weightUnit: 'kg',
  dimensionsWidth: '0',
  dimensionsHeight: '0',
  dimensionsLength: '0',
  dimensionsUnit: 'mm',
  optionValues: [],
};

function toCurrencyCode(value) {
  return String(value || 'qar').trim().toLowerCase();
}

function getVariantMoney(variant) {
  if (variant?.price && typeof variant.price === 'object') return variant.price;
  if (variant?.cost && typeof variant.cost === 'object') return variant.cost;
  return { amount: 0, currencyCode: 'qar' };
}

function getVariantQuantity(variant) {
  const inventoryLevels = Array.isArray(variant?.inventoryItem?.levels) ? variant.inventoryItem.levels : [];
  if (inventoryLevels.length === 0) return '';

  const quantity = inventoryLevels[0]?.quantity;
  if (quantity === undefined || quantity === null || quantity === '') return '';

  return String(quantity);
}

function toLocalizedText(enValue, arValue = '') {
  const en = String(enValue || '').trim();
  const ar = String(arValue || '').trim();
  return {
    en,
    ar: ar || en,
  };
}

function toVariantTitle(enValue, arValue = '') {
  const en = String(enValue || '').trim().slice(0, 100);
  const arRaw = String(arValue || '').trim();
  const ar = (arRaw || en).slice(0, 100);
  return { en, ar };
}

function getVariantDisplayImage(variant) {
  const images = Array.isArray(variant?.images) ? variant.images : [];
  if (images.length === 0) return '';

  const featuredEnabled = images.find((img) => Boolean(img?.isEnabled) && Boolean(img?.isFeatured));
  if (featuredEnabled?.imageUrl || featuredEnabled?.thumbnailUrl) {
    return featuredEnabled.thumbnailUrl || featuredEnabled.imageUrl;
  }

  const first = images[0];
  return first?.thumbnailUrl || first?.imageUrl || '';
}

function getVariantOptionValuesText(variant) {
  const values = Array.isArray(variant?.optionValues) ? variant.optionValues : [];
  return values
    .map((item) => {
      const option = item?.optionValue?.option;
      const optionName = String(option?.nameEn || option?.name || '').trim();
      const value = String(item?.optionValue?.valueEn || item?.optionValue?.value || '').trim();
      if (optionName && value) return `${optionName}: ${value}`;
      return value || '';
    })
    .filter(Boolean);
}

function get1688OfferUrl(procurementId) {
  const value = String(procurementId || '').trim();
  return value ? `https://detail.1688.com/offer/${encodeURIComponent(value)}.html` : '';
}

export default function ProductShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [mounted, setMounted] = useState(false);
  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [product, setProduct] = useState(null);
  const [galleryPreviewUrl, setGalleryPreviewUrl] = useState('');

  const [showDeleteProductModal, setShowDeleteProductModal] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [resyncingVariants, setResyncingVariants] = useState(false);

  const [showCreateOptionModal, setShowCreateOptionModal] = useState(false);
  const [showEditOptionModal, setShowEditOptionModal] = useState(false);
  const [showDeleteOptionModal, setShowDeleteOptionModal] = useState(false);
  const [optionForm, setOptionForm] = useState(EMPTY_OPTION_FORM);
  const [selectedOption, setSelectedOption] = useState(null);
  const [optionSaving, setOptionSaving] = useState(false);
  const [optionDeleting, setOptionDeleting] = useState(false);

  const [showCreateValueModal, setShowCreateValueModal] = useState(false);
  const [showEditValueModal, setShowEditValueModal] = useState(false);
  const [showDeleteValueModal, setShowDeleteValueModal] = useState(false);
  const [valueForm, setValueForm] = useState(EMPTY_VALUE_FORM);
  const [selectedValue, setSelectedValue] = useState(null);
  const [activeOptionForValue, setActiveOptionForValue] = useState(null);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueDeleting, setValueDeleting] = useState(false);

  const [showCreateVariantModal, setShowCreateVariantModal] = useState(false);
  const [showEditVariantModal, setShowEditVariantModal] = useState(false);
  const [showDeleteVariantModal, setShowDeleteVariantModal] = useState(false);
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT_FORM);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantDeleting, setVariantDeleting] = useState(false);
  const [defaultWarehouseUUID, setDefaultWarehouseUUID] = useState('');

  const [showVariantImagesModal, setShowVariantImagesModal] = useState(false);
  const [variantImages, setVariantImages] = useState([]);
  const [variantImagesLoading, setVariantImagesLoading] = useState(false);
  const [variantImagesUploading, setVariantImagesUploading] = useState(false);
  const [variantImageUpdatingUUID, setVariantImageUpdatingUUID] = useState('');
  const [productFeaturedUpdatingUUID, setProductFeaturedUpdatingUUID] = useState('');
  const [openVariantImageMenuUUID, setOpenVariantImageMenuUUID] = useState('');
  const [variantImagesError, setVariantImagesError] = useState('');

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  useEffect(() => {
    setMounted(true);
  }, []);

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
  const optionValueChoices = useMemo(
    () =>
      Array.isArray(product?.options)
        ? product.options.flatMap((option) =>
            (option?.values || []).map((value) => ({
              optionName: option?.nameEn || option?.name || 'Option',
              uuid: value?.uuid,
              value: value?.valueEn || value?.value || '',
            }))
          )
        : [],
    [product?.options]
  );

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
        const message = Array.isArray(payload?.message) ? payload.message.filter(Boolean).join('; ') : payload?.message;
        const backendError = payload?.errors?.error || payload?.errors?.slug || message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  // Must be defined before callbacks that reference it in their dependency arrays.
  // Otherwise `loadProduct` hits the temporal-dead-zone during hook initialization.
  const loadProduct = useCallback(async () => {
    if (!token || !uuid) return;

    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/products/${uuid}`, { method: 'GET' });
      setProduct(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token, uuid]);

  const loadVariantImages = useCallback(
    async (variantUUID) => {
      if (!token || !uuid || !variantUUID) return;
      setVariantImagesLoading(true);
      setVariantImagesError('');
      try {
        const data = await apiFetch(
          `/api/products/${uuid}/variants/${variantUUID}/images?pageNumber=1&itemsPerPage=100`,
          { method: 'GET' }
        );
        setVariantImages(Array.isArray(data) ? data : []);
      } catch (err) {
        setVariantImagesError(err.message || 'Failed to load images.');
        setVariantImages([]);
      } finally {
        setVariantImagesLoading(false);
      }
    },
    [apiFetch, token, uuid]
  );

  const onUploadVariantImage = useCallback(
    async (variantUUID, file) => {
      if (!token || !uuid || !variantUUID || !file) return;
      setVariantImagesUploading(true);
      setVariantImagesError('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        await apiFetch(`/api/products/${uuid}/variants/${variantUUID}/images`, {
          method: 'POST',
          body: formData,
        });
        await loadVariantImages(variantUUID);
        await loadProduct();
      } catch (err) {
        setVariantImagesError(err.message || 'Failed to upload image.');
      } finally {
        setVariantImagesUploading(false);
      }
    },
    [apiFetch, loadProduct, loadVariantImages, token, uuid]
  );

  const onDeleteVariantImage = useCallback(
    async (variantUUID, imageUUID) => {
      if (!token || !uuid || !variantUUID || !imageUUID) return;
      setVariantImagesError('');
      try {
        await apiFetch(`/api/products/${uuid}/variants/${variantUUID}/images/${imageUUID}`, { method: 'DELETE' });
        await loadVariantImages(variantUUID);
        await loadProduct();
      } catch (err) {
        setVariantImagesError(err.message || 'Failed to delete image.');
      }
    },
    [apiFetch, loadProduct, loadVariantImages, token, uuid]
  );

  const onUpdateVariantImage = useCallback(
    async (variantUUID, image, nextFeatured) => {
      if (!token || !uuid || !variantUUID || !image?.uuid) return;
      setVariantImagesError('');
      setVariantImageUpdatingUUID(image.uuid);
      try {
        await apiFetch(`/api/products/${uuid}/variants/${variantUUID}/images/${image.uuid}`, {
          method: 'PUT',
          body: JSON.stringify({
            alt: String(image.alt || 'product-variant-image').slice(0, 100),
            position: Number.isFinite(Number(image.position)) ? Number(image.position) : 0,
            isFeatured: Boolean(nextFeatured),
          }),
        });
        await loadVariantImages(variantUUID);
        await loadProduct();
      } catch (err) {
        setVariantImagesError(err.message || 'Failed to update image.');
      } finally {
        setVariantImageUpdatingUUID('');
      }
    },
    [apiFetch, loadProduct, loadVariantImages, token, uuid]
  );

  const onUpdateProductFeaturedImage = useCallback(
    async (variantUUID, imageUUID) => {
      if (!token || !uuid || !variantUUID || !imageUUID) return;
      setVariantImagesError('');
      setProductFeaturedUpdatingUUID(imageUUID);
      try {
        await apiFetch(`/api/products/${uuid}/featured-image`, {
          method: 'PUT',
          body: JSON.stringify({ imageUUID }),
        });
        await loadProduct();
        await loadVariantImages(variantUUID);
      } catch (err) {
        setVariantImagesError(err.message || 'Failed to update product featured image.');
      } finally {
        setProductFeaturedUpdatingUUID('');
      }
    },
    [apiFetch, loadProduct, loadVariantImages, token, uuid]
  );

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!showVariantImagesModal || !openVariantImageMenuUUID) return;

    const onClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-variant-image-menu-wrapper="true"]')) return;
      setOpenVariantImageMenuUUID('');
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [openVariantImageMenuUUID, showVariantImagesModal]);

  useEffect(() => {
    if (!token) return;

    const loadDefaultWarehouse = async () => {
      try {
        const data = await apiFetch('/api/warehouses?pageNumber=1&itemsPerPage=1', { method: 'GET' });
        if (Array.isArray(data) && data[0]?.uuid) {
          setDefaultWarehouseUUID(data[0].uuid);
        }
      } catch {
        setDefaultWarehouseUUID('');
      }
    };

    loadDefaultWarehouse();
  }, [apiFetch, token]);

  const onDeleteProduct = async () => {
    if (!uuid) return;

    setDeletingProduct(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}`, { method: 'DELETE' });
      router.push('/products');
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    } finally {
      setDeletingProduct(false);
      setShowDeleteProductModal(false);
    }
  };

  const onResyncVariants = async () => {
    if (!uuid) return;
    setResyncingVariants(true);
    setError('');
    setMessage('');
    try {
      const response = await apiFetch('/api/procurement/resync-variants', {
        method: 'POST',
        body: JSON.stringify({ productUuids: [uuid] }),
      });
      await loadProduct();
      setMessage(
        `Variants resynced. Matched: ${response?.variantsMatched ?? 0}, Updated: ${response?.variantsUpdated ?? 0}, Missing in source: ${response?.variantsMissingInSource ?? 0}.`
      );
    } catch (err) {
      setError(err.message || 'Failed to resync variants.');
    } finally {
      setResyncingVariants(false);
    }
  };

  const onCreateOption = async () => {
    if (!uuid) return;
    setOptionSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options`, {
        method: 'POST',
        body: JSON.stringify({
          name: toLocalizedText(optionForm.name),
          position: Number(optionForm.position),
        }),
      });
      setShowCreateOptionModal(false);
      setOptionForm(EMPTY_OPTION_FORM);
      setMessage('Option created.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to create option.');
    } finally {
      setOptionSaving(false);
    }
  };

  const onEditOption = async () => {
    if (!uuid || !selectedOption?.uuid) return;
    setOptionSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options/${selectedOption.uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: toLocalizedText(optionForm.name),
          position: Number(optionForm.position),
        }),
      });
      setShowEditOptionModal(false);
      setSelectedOption(null);
      setOptionForm(EMPTY_OPTION_FORM);
      setMessage('Option updated.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to update option.');
    } finally {
      setOptionSaving(false);
    }
  };

  const onDeleteOption = async () => {
    if (!uuid || !selectedOption?.uuid) return;
    setOptionDeleting(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options/${selectedOption.uuid}`, { method: 'DELETE' });
      setShowDeleteOptionModal(false);
      setSelectedOption(null);
      setMessage('Option deleted.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to delete option.');
    } finally {
      setOptionDeleting(false);
    }
  };

  const onCreateValue = async () => {
    if (!uuid || !activeOptionForValue?.uuid) return;
    setValueSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options/${activeOptionForValue.uuid}/values`, {
        method: 'POST',
        body: JSON.stringify({
          value: toLocalizedText(valueForm.value),
          position: Number(valueForm.position),
        }),
      });
      setShowCreateValueModal(false);
      setActiveOptionForValue(null);
      setValueForm(EMPTY_VALUE_FORM);
      setMessage('Option value created.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to create option value.');
    } finally {
      setValueSaving(false);
    }
  };

  const onEditValue = async () => {
    if (!uuid || !activeOptionForValue?.uuid || !selectedValue?.uuid) return;
    setValueSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options/${activeOptionForValue.uuid}/values/${selectedValue.uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          value: toLocalizedText(valueForm.value),
          position: Number(valueForm.position),
        }),
      });
      setShowEditValueModal(false);
      setSelectedValue(null);
      setActiveOptionForValue(null);
      setValueForm(EMPTY_VALUE_FORM);
      setMessage('Option value updated.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to update option value.');
    } finally {
      setValueSaving(false);
    }
  };

  const onDeleteValue = async () => {
    if (!uuid || !activeOptionForValue?.uuid || !selectedValue?.uuid) return;
    setValueDeleting(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/options/${activeOptionForValue.uuid}/values/${selectedValue.uuid}`, {
        method: 'DELETE',
      });
      setShowDeleteValueModal(false);
      setSelectedValue(null);
      setActiveOptionForValue(null);
      setMessage('Option value deleted.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to delete option value.');
    } finally {
      setValueDeleting(false);
    }
  };

  const onCreateVariant = async () => {
    if (!uuid) return;
    if (!defaultWarehouseUUID) {
      setError('No warehouse found. Please create at least one warehouse first.');
      return;
    }
    setVariantSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/variants`, {
        method: 'PUT',
        body: JSON.stringify({
          warehouse: defaultWarehouseUUID,
          title: toVariantTitle(variantForm.titleEn, variantForm.titleAr),
          sku: variantForm.sku.trim(),
          quantity: Math.round(Number(variantForm.quantity)),
          barcode: variantForm.barcode.trim(),
          cost: {
            amount: Math.round(Number(variantForm.priceAmount)),
            currencyCode: toCurrencyCode(variantForm.priceCurrencyCode),
          },
          weight: {
            amount: Math.round(Number(variantForm.weightAmount)),
            unit: variantForm.weightUnit.trim(),
          },
          dimensions: {
            width: Math.round(Number(variantForm.dimensionsWidth)),
            height: Math.round(Number(variantForm.dimensionsHeight)),
            length: Math.round(Number(variantForm.dimensionsLength)),
            unit: variantForm.dimensionsUnit.trim(),
          },
          optionValues: variantForm.optionValues,
        }),
      });
      setShowCreateVariantModal(false);
      setVariantForm(EMPTY_VARIANT_FORM);
      setMessage('Variant created.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to create variant.');
    } finally {
      setVariantSaving(false);
    }
  };

  const onEditVariant = async () => {
    if (!uuid || !selectedVariant?.uuid) return;
    setVariantSaving(true);
    setError('');
    setMessage('');
    try {
      const quantityValue = String(variantForm.quantity ?? '').trim();
      const payload = {
        title: toVariantTitle(variantForm.titleEn, variantForm.titleAr),
        sku: variantForm.sku.trim(),
        barcode: variantForm.barcode.trim(),
        price: {
          amount: Math.round(Number(variantForm.priceAmount)),
          currencyCode: toCurrencyCode(variantForm.priceCurrencyCode),
        },
        weight: {
          amount: Math.round(Number(variantForm.weightAmount)),
          unit: variantForm.weightUnit.trim(),
        },
        dimensions: {
          width: Math.round(Number(variantForm.dimensionsWidth)),
          height: Math.round(Number(variantForm.dimensionsHeight)),
          length: Math.round(Number(variantForm.dimensionsLength)),
          unit: variantForm.dimensionsUnit.trim(),
        },
      };

      if (quantityValue !== '') {
        payload.quantity = Math.round(Number(quantityValue));
      }

      await apiFetch(`/api/products/${uuid}/variants/${selectedVariant.uuid}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setShowEditVariantModal(false);
      setSelectedVariant(null);
      setVariantForm(EMPTY_VARIANT_FORM);
      setMessage('Variant updated.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to update variant.');
    } finally {
      setVariantSaving(false);
    }
  };

  const onDeleteVariant = async () => {
    if (!uuid || !selectedVariant?.uuid) return;
    setVariantDeleting(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/products/${uuid}/variants/${selectedVariant.uuid}`, { method: 'DELETE' });
      setShowDeleteVariantModal(false);
      setSelectedVariant(null);
      setMessage('Variant deleted.');
      await loadProduct();
    } catch (err) {
      setError(err.message || 'Failed to delete variant.');
    } finally {
      setVariantDeleting(false);
    }
  };

  if (!mounted || !isValid) {
    return <div className="screen-center">Loading product...</div>;
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
                    <h4 className="card-title mb-0">Product Details</h4>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        type="button"
                        onClick={onResyncVariants}
                        disabled={resyncingVariants || loading}
                      >
                        {resyncingVariants ? 'Resyncing...' : 'Resync Variants'}
                      </button>
                      <Link href={`/products/${uuid}/edit`} className="btn btn-primary btn-sm">
                        Edit
                      </Link>
                      {product?.procurementId || product?.procurement_id ? (
                        <a
                          href={get1688OfferUrl(product.procurementId || product.procurement_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline-secondary btn-sm"
                        >
                          View on 1688
                        </a>
                      ) : null}
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => setShowDeleteProductModal(true)}>
                        Delete
                      </button>
                      <Link href="/products" className="btn btn-outline-primary btn-sm">
                        Back to Products
                      </Link>
                    </div>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    {loading ? <p className="mb-0">Loading product...</p> : null}

                    {!loading && product ? (
                      <>
                        <div className="table-responsive mb-4">
                          <table className="table table-bordered mb-0">
                            <tbody>
                              <tr>
                                <th style={{ width: '260px' }}>UUID</th>
                                <td>{product.uuid || '-'}</td>
                              </tr>
                              <tr>
                                <th>Slug</th>
                                <td>{product.slug || '-'}</td>
                              </tr>
                              <tr>
                                <th>Status</th>
                                <td>{product.status || '-'}</td>
                              </tr>
                              <tr>
                                <th>Procurement Type</th>
                                <td>{product.procurement_type || product.procurementType || 'Not available'}</td>
                              </tr>
                              <tr>
                                <th>Procurement ID</th>
                                <td>
                                  <div className="d-flex align-items-center flex-wrap" style={{ gap: '8px' }}>
                                    <span>{product.procurement_id || product.procurementId || 'Not available'}</span>
                                    {product.procurementId || product.procurement_id ? (
                                      <a
                                        href={get1688OfferUrl(product.procurementId || product.procurement_id)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-outline-secondary btn-xs"
                                      >
                                        Open 1688
                                      </a>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <th>Urgency Enabled</th>
                                <td>{product.urgencyEnabled ? 'Yes' : 'No'}</td>
                              </tr>
                              <tr>
                                <th>Manual Stock Count</th>
                                <td>{product.urgencyStockCount ?? '-'}</td>
                              </tr>
                              <tr>
                                <th>Resolved Stock Count</th>
                                <td>{product.stockCount ?? '-'}</td>
                              </tr>
                              <tr>
                                <th>Title (EN)</th>
                                <td>{product.titleEn || product.title || '-'}</td>
                              </tr>
                              <tr>
                                <th>Title (AR)</th>
                                <td>{product.titleAr || '-'}</td>
                              </tr>
                              <tr>
                                <th>Brief (EN)</th>
                                <td>{product.briefEn || product.brief || '-'}</td>
                              </tr>
                              <tr>
                                <th>Brief (AR)</th>
                                <td>{product.briefAr || '-'}</td>
                              </tr>
                              <tr>
                                <th>Featured Image</th>
                                <td>
                                  {product.featuredImageUrl || product.featuredThumbnailUrl ? (
                                    <div>
                                      <img
                                        src={getTransformedImageUrl(product.featuredThumbnailUrl || product.featuredImageUrl)}
                                        alt="Product featured"
                                        style={{
                                          width: '220px',
                                          height: '160px',
                                          objectFit: 'cover',
                                          borderRadius: '10px',
                                          border: '1px solid #eee',
                                        }}
                                      />
                                      <div className="mt-2 text-muted">
                                        To update this image, open a variant&apos;s <strong>Images</strong> modal and use the 3-dots menu on
                                        the target image, then click <strong>Set as Product Featured</strong>.
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-muted">
                                      No featured image set. Select one from a variant image using the Images modal.
                                    </div>
                                  )}
                                </td>
                              </tr>
                              <tr>
                                <th>Size Chart Image</th>
                                <td>
                                  {product.sizechartUrl ? (
                                    <img
                                      src={getTransformedImageUrl(product.sizechartUrl)}
                                      alt="Product size chart"
                                      style={{
                                        width: '220px',
                                        height: '160px',
                                        objectFit: 'contain',
                                        borderRadius: '10px',
                                        border: '1px solid #eee',
                                        background: '#fff',
                                      }}
                                    />
                                  ) : (
                                    <div className="text-muted">No size chart image uploaded.</div>
                                  )}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="mb-4">
                          <h5 className="mb-3 fw-bold h5-heading">Gallery</h5>
                          {Array.isArray(product.attachments) && product.attachments.length > 0 ? (
                            <div className="d-flex flex-wrap" style={{ gap: '12px' }}>
                              {product.attachments.map((attachment) => {
                                const isImage = String(attachment?.mediaType || '').toLowerCase() === 'image';
                                const attachmentUrl = getTransformedImageUrl(attachment?.mediaUrl || '');
                                return (
                                  <div
                                    key={attachment?.uuid}
                                    className="border rounded p-0"
                                    style={{ width: '124px', background: '#fff' }}
                                  >
                                    <div
                                      className="d-flex align-items-center justify-content-center mb-2"
                                      style={{
                                        width: '100%',
                                        height: '88px',
                                        background: '#f8f8f8',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        cursor: isImage ? 'zoom-in' : 'default',
                                      }}
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
                                        <small className="text-muted px-2 text-center">File</small>
                                      )}
                                    </div>
                                    
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-muted">No attachments found.</div>
                          )}
                        </div>

                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0 fw-bold h5-heading">Options</h5>
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => {
                              setOptionForm(EMPTY_OPTION_FORM);
                              setShowCreateOptionModal(true);
                            }}
                          >
                            Add Option
                          </button>
                        </div>

                        {Array.isArray(product.options) && product.options.length > 0 ? (
                          <div className="table-responsive mb-4">
                            <table className="table table-striped">
                              <thead>
                                <tr>
                                  <th>Option Name</th>
                                  <th>Position</th>
                                  <th>Values</th>
                                  <th style={{ minWidth: '260px' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.options.map((option) => (
                                  <tr key={option.uuid}>
                                    <td>{option.nameEn || option.name || '-'}</td>
                                    <td>{option.position ?? '-'}</td>
                                    <td>
                                      <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                        {Array.isArray(option.values) && option.values.length > 0
                                          ? option.values.map((value) => (
                                              <span key={value.uuid} className="badge badge-light">
                                                {value.valueEn || value.value} ({value.position})
                                              </span>
                                            ))
                                          : 'No values'}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                                        <button
                                          className="btn btn-sm btn-outline-primary"
                                          type="button"
                                          onClick={() => {
                                            setSelectedOption(option);
                                            setOptionForm({
                                              name: option.nameEn || option.name || '',
                                              position: String(option.position ?? 0),
                                            });
                                            setShowEditOptionModal(true);
                                          }}
                                        >
                                          Edit Option
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-success"
                                          type="button"
                                          onClick={() => {
                                            setActiveOptionForValue(option);
                                            setValueForm(EMPTY_VALUE_FORM);
                                            setShowCreateValueModal(true);
                                          }}
                                        >
                                          Add Value
                                        </button>
                                        <button
                                          className="btn btn-sm btn-outline-danger"
                                          type="button"
                                          onClick={() => {
                                            setSelectedOption(option);
                                            setShowDeleteOptionModal(true);
                                          }}
                                        >
                                          Delete Option
                                        </button>
                                      </div>
                                      {Array.isArray(option.values) && option.values.length > 0 ? (
                                        <div className="mt-2 d-flex flex-wrap" style={{ gap: '6px' }}>
                                          {option.values.map((value) => (
                                            <div key={value.uuid} className="d-flex align-items-center" style={{ gap: '6px' }}>
                                              <button
                                                type="button"
                                                className="btn btn-xs btn-light"
                                                onClick={() => {
                                                  setActiveOptionForValue(option);
                                                  setSelectedValue(value);
                                                  setValueForm({
                                                    value: value.valueEn || value.value || '',
                                                    position: String(value.position ?? 0),
                                                  });
                                                  setShowEditValueModal(true);
                                                }}
                                              >
                                                Edit {value.valueEn || value.value}
                                              </button>
                                              <button
                                                type="button"
                                                className="btn btn-xs btn-outline-danger"
                                                onClick={() => {
                                                  setActiveOptionForValue(option);
                                                  setSelectedValue(value);
                                                  setShowDeleteValueModal(true);
                                                }}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="mb-4">No options found.</p>
                        )}

                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0 fw-bold h5-heading">Variants</h5>
                          <button
                            className="btn btn-sm btn-primary"
                            type="button"
                            onClick={() => {
                              setVariantForm(EMPTY_VARIANT_FORM);
                              setShowCreateVariantModal(true);
                            }}
                          >
                            Add Variant
                          </button>
                        </div>
                        {Array.isArray(product.variants) && product.variants.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-striped mb-0">
                              <thead>
                                <tr>
                                  <th>Image</th>
                                  <th>Title</th>
                                  <th>SKU</th>
                                  <th>Options</th>
                                  <th>Barcode</th>
                                  <th>Price</th>
                                  <th style={{ minWidth: '180px' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.variants.map((variant) => (
                                  <tr key={variant.uuid}>
                                    <td>
                                      {getVariantDisplayImage(variant) ? (
                                        <img
                                          src={getTransformedImageUrl(getVariantDisplayImage(variant))}
                                          alt="Variant"
                                          style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px' }}
                                        />
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td>{variant.titleEn || variant.title || '-'}</td>
                                    <td>{variant.sku || '-'}</td>
                                    <td>
                                      {getVariantOptionValuesText(variant).length > 0 ? (
                                        <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                                          {getVariantOptionValuesText(variant).map((label, index) => (
                                            <span key={`${variant.uuid}-opt-${index}`} className="badge badge-light border text-dark">
                                              {label}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                    <td>{variant.barcode || '-'}</td>
                                    <td>
                                      {getVariantMoney(variant)?.amount ?? '-'} {getVariantMoney(variant)?.currencyCode || ''}
                                    </td>
                                    <td>
                                      <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-primary"
                                          onClick={() => {
                                            setSelectedVariant(variant);
                                            const variantMoney = getVariantMoney(variant);
                                            setVariantForm({
                                              titleEn: variant?.titleEn || variant?.title || '',
                                              titleAr: variant?.titleAr || variant?.titleEn || variant?.title || '',
                                              sku: variant?.sku || '',
                                              quantity: getVariantQuantity(variant),
                                              barcode: variant?.barcode || '',
                                              priceAmount: String(variantMoney?.amount ?? 0),
                                              priceCurrencyCode: toCurrencyCode(variantMoney?.currencyCode),
                                              weightAmount: String(variant?.weight?.amount ?? 0),
                                              weightUnit: variant?.weight?.unit || 'kg',
                                              dimensionsWidth: String(variant?.dimensions?.width ?? 0),
                                              dimensionsHeight: String(variant?.dimensions?.height ?? 0),
                                              dimensionsLength: String(variant?.dimensions?.length ?? 0),
                                              dimensionsUnit: variant?.dimensions?.unit || 'mm',
                                              optionValues: Array.isArray(variant?.optionValues)
                                                ? variant.optionValues
                                                    .map((item) => item?.optionValue?.uuid || item?.uuid)
                                                    .filter(Boolean)
                                                : [],
                                            });
                                            setShowEditVariantModal(true);
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-dark"
                                          onClick={async () => {
                                            setSelectedVariant(variant);
                                            setShowVariantImagesModal(true);
                                            await loadVariantImages(variant.uuid);
                                          }}
                                        >
                                          Images
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger"
                                          onClick={() => {
                                            setSelectedVariant(variant);
                                            setShowDeleteVariantModal(true);
                                          }}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="mb-0">No variants found.</p>
                        )}
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

      {showDeleteProductModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Product</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteProductModal(false)}
                    disabled={deletingProduct}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete product <strong>{product?.titleEn || product?.title || product?.slug || ''}</strong>? This action
                    cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteProductModal(false)}
                    disabled={deletingProduct}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteProduct} disabled={deletingProduct}>
                    {deletingProduct ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showCreateOptionModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Create Option</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowCreateOptionModal(false)}
                    disabled={optionSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name</label>
                    <input
                      className="form-control"
                      value={optionForm.name}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Position</label>
                    <input
                      type="number"
                      className="form-control"
                      value={optionForm.position}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, position: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowCreateOptionModal(false)}
                    disabled={optionSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onCreateOption} disabled={optionSaving}>
                    {optionSaving ? 'Saving...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showEditOptionModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Option</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowEditOptionModal(false)}
                    disabled={optionSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Name</label>
                    <input
                      className="form-control"
                      value={optionForm.name}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Position</label>
                    <input
                      type="number"
                      className="form-control"
                      value={optionForm.position}
                      onChange={(e) => setOptionForm((prev) => ({ ...prev, position: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowEditOptionModal(false)}
                    disabled={optionSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onEditOption} disabled={optionSaving}>
                    {optionSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showDeleteOptionModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Option</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteOptionModal(false)}
                    disabled={optionDeleting}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete option <strong>{selectedOption?.nameEn || selectedOption?.name || ''}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteOptionModal(false)}
                    disabled={optionDeleting}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteOption} disabled={optionDeleting}>
                    {optionDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showCreateValueModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Create Option Value ({activeOptionForValue?.nameEn || activeOptionForValue?.name || ''})</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowCreateValueModal(false)}
                    disabled={valueSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Value</label>
                    <input
                      className="form-control"
                      value={valueForm.value}
                      onChange={(e) => setValueForm((prev) => ({ ...prev, value: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Position</label>
                    <input
                      type="number"
                      className="form-control"
                      value={valueForm.position}
                      onChange={(e) => setValueForm((prev) => ({ ...prev, position: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowCreateValueModal(false)}
                    disabled={valueSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onCreateValue} disabled={valueSaving}>
                    {valueSaving ? 'Saving...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showEditValueModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Option Value ({activeOptionForValue?.nameEn || activeOptionForValue?.name || ''})</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowEditValueModal(false)}
                    disabled={valueSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Value</label>
                    <input
                      className="form-control"
                      value={valueForm.value}
                      onChange={(e) => setValueForm((prev) => ({ ...prev, value: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Position</label>
                    <input
                      type="number"
                      className="form-control"
                      value={valueForm.position}
                      onChange={(e) => setValueForm((prev) => ({ ...prev, position: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowEditValueModal(false)}
                    disabled={valueSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onEditValue} disabled={valueSaving}>
                    {valueSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showDeleteValueModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Option Value</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteValueModal(false)}
                    disabled={valueDeleting}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete value <strong>{selectedValue?.value || ''}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteValueModal(false)}
                    disabled={valueDeleting}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteValue} disabled={valueDeleting}>
                    {valueDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showCreateVariantModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content" style={{ overflow: 'visible' }}>
                <div className="modal-header">
                  <h5 className="modal-title">Create Variant</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowCreateVariantModal(false)}
                    disabled={variantSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body" style={{ overflow: 'visible' }}>
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Title (EN)</label>
                      <input
                        className="form-control"
                        value={variantForm.titleEn}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Title (AR)</label>
                      <input
                        className="form-control"
                        value={variantForm.titleAr}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, titleAr: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">SKU</label>
                      <input
                        className="form-control"
                        value={variantForm.sku}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, sku: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.quantity}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Barcode</label>
                      <input
                        className="form-control"
                        value={variantForm.barcode}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, barcode: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Price Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.priceAmount}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, priceAmount: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Currency Code</label>
                      <select
                        className="form-control"
                        value={variantForm.priceCurrencyCode}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                      >
                        <option value="qar">QAR</option>
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="sar">SAR</option>
                        <option value="aed">AED</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Weight Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.weightAmount}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, weightAmount: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Weight Unit</label>
                      <select
                        className="form-control"
                        value={variantForm.weightUnit}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, weightUnit: e.target.value }))}
                      >
                        <option value="g">Grams (g)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="oz">Ounces (oz)</option>
                        <option value="lb">Pounds (lb)</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Width</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsWidth}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsWidth: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Height</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsHeight}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsHeight: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Length</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsLength}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsLength: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Dimension Unit</label>
                      <select
                        className="form-control"
                        value={variantForm.dimensionsUnit}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsUnit: e.target.value }))}
                      >
                        <option value="mm">Millimeter (mm)</option>
                        <option value="cm">Centimeter (cm)</option>
                        <option value="m">Meter (m)</option>
                        <option value="km">Kilometer (km)</option>
                        <option value="in">Inch (in)</option>
                        <option value="ft">Foot (ft)</option>
                        <option value="yd">Yard (yd)</option>
                        <option value="mi">Mile (mi)</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Option Values</label>
                      <div className="border rounded p-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {optionValueChoices.length > 0 ? (
                          optionValueChoices.map((item) => (
                            <label key={item.uuid} className="d-flex align-items-center mb-2" style={{ gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={variantForm.optionValues.includes(item.uuid)}
                                onChange={(e) => {
                                  setVariantForm((prev) => ({
                                    ...prev,
                                    optionValues: e.target.checked
                                      ? [...prev.optionValues, item.uuid]
                                      : prev.optionValues.filter((uuidValue) => uuidValue !== item.uuid),
                                  }));
                                }}
                              />
                              <span>
                                {item.optionName}: {item.value}
                              </span>
                            </label>
                          ))
                        ) : (
                          <small className="text-muted">No option values available.</small>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowCreateVariantModal(false)}
                    disabled={variantSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onCreateVariant} disabled={variantSaving}>
                    {variantSaving ? 'Saving...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showEditVariantModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Edit Variant</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowEditVariantModal(false)}
                    disabled={variantSaving}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Title (EN)</label>
                      <input
                        className="form-control"
                        value={variantForm.titleEn}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, titleEn: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-12 mb-3">
                      <label className="form-label">Title (AR)</label>
                      <input
                        className="form-control"
                        value={variantForm.titleAr}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, titleAr: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">SKU</label>
                      <input
                        className="form-control"
                        value={variantForm.sku}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, sku: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={variantForm.quantity}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Barcode</label>
                      <input
                        className="form-control"
                        value={variantForm.barcode}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, barcode: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Price Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.priceAmount}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, priceAmount: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Currency Code</label>
                      <select
                        className="form-control"
                        value={variantForm.priceCurrencyCode}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                      >
                        <option value="qar">QAR</option>
                        <option value="usd">USD</option>
                        <option value="eur">EUR</option>
                        <option value="sar">SAR</option>
                        <option value="aed">AED</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Weight Amount</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.weightAmount}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, weightAmount: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Weight Unit</label>
                      <select
                        className="form-control"
                        value={variantForm.weightUnit}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, weightUnit: e.target.value }))}
                      >
                        <option value="g">Grams (g)</option>
                        <option value="kg">Kilograms (kg)</option>
                        <option value="oz">Ounces (oz)</option>
                        <option value="lb">Pounds (lb)</option>
                      </select>
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Width</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsWidth}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsWidth: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Height</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsHeight}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsHeight: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Length</label>
                      <input
                        type="number"
                        className="form-control"
                        value={variantForm.dimensionsLength}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsLength: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Dimension Unit</label>
                      <select
                        className="form-control"
                        value={variantForm.dimensionsUnit}
                        onChange={(e) => setVariantForm((prev) => ({ ...prev, dimensionsUnit: e.target.value }))}
                      >
                        <option value="mm">Millimeter (mm)</option>
                        <option value="cm">Centimeter (cm)</option>
                        <option value="m">Meter (m)</option>
                        <option value="km">Kilometer (km)</option>
                        <option value="in">Inch (in)</option>
                        <option value="ft">Foot (ft)</option>
                        <option value="yd">Yard (yd)</option>
                        <option value="mi">Mile (mi)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowEditVariantModal(false)}
                    disabled={variantSaving}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={onEditVariant} disabled={variantSaving}>
                    {variantSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showDeleteVariantModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Variant</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteVariantModal(false)}
                    disabled={variantDeleting}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete variant <strong>{selectedVariant?.title || selectedVariant?.sku || ''}</strong>?
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteVariantModal(false)}
                    disabled={variantDeleting}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteVariant} disabled={variantDeleting}>
                    {variantDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      {showVariantImagesModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Variant Images</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => {
                      setShowVariantImagesModal(false);
                      setOpenVariantImageMenuUUID('');
                      setVariantImages([]);
                      setVariantImagesError('');
                    }}
                    disabled={variantImagesUploading}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  {variantImagesError ? <div className="alert alert-danger">{variantImagesError}</div> : null}
                  <div className="d-flex align-items-center justify-content-between mb-3" style={{ gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {selectedVariant?.titleEn || selectedVariant?.title || selectedVariant?.sku || 'Variant'}
                      </div>
                      <small className="text-muted">{selectedVariant?.uuid || ''}</small>
                    </div>
                    <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={variantImagesUploading || variantImagesLoading || !selectedVariant?.uuid}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !selectedVariant?.uuid) return;
                          await onUploadVariantImage(selectedVariant.uuid, file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        disabled={variantImagesLoading || variantImagesUploading || !selectedVariant?.uuid}
                        onClick={() => loadVariantImages(selectedVariant.uuid)}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {variantImagesLoading ? <p className="mb-0">Loading images...</p> : null}
                  {!variantImagesLoading && variantImages.length === 0 ? <p className="mb-0">No images found.</p> : null}

                  {!variantImagesLoading && variantImages.length > 0 ? (
                    <div className="row">
                      {variantImages.map((img) => (
                        <div className="col-md-4 mb-3" key={img.uuid}>
                          {(() => {
                            const imageUrl = String(img?.imageUrl || '').trim();
                            const productFeaturedImage = String(product?.featuredImageUrl || '').trim();
                            const isProductFeatured = Boolean(imageUrl && productFeaturedImage && imageUrl === productFeaturedImage);
                            return (
                          <div className="border rounded p-2 h-100">
                            <div className="mb-2">
                              <div style={{ position: 'relative' }} data-variant-image-menu-wrapper="true">
                                <img
                                  src={getTransformedImageUrl(img.thumbnailUrl || img.imageUrl)}
                                  alt={img.alt || 'variant image'}
                                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px' }}
                                />
                                {img?.isFeatured ? (
                                  <span
                                    className="badge badge-success"
                                    style={{
                                      position: 'absolute',
                                      top: '8px',
                                      right: '8px',
                                      fontSize: '11px',
                                      lineHeight: '1',
                                      padding: '5px 8px',
                                      borderRadius: '10px',
                                      maxWidth: '120px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    Featured
                                  </span>
                                ) : null}
                                {isProductFeatured ? (
                                  <span
                                    className="badge"
                                    style={{
                                      position: 'absolute',
                                      top: '8px',
                                      left: '8px',
                                      fontSize: '11px',
                                      lineHeight: '1',
                                      padding: '5px 8px',
                                      borderRadius: '10px',
                                      backgroundColor: '#d4af37',
                                      color: '#1f1f1f',
                                      maxWidth: '130px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    Product Featured
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mb-2 d-flex align-items-center justify-content-between" style={{ gap: '8px' }}>
                              <small className="text-muted">Position: {img?.position ?? 0}</small>
                              <div style={{ position: 'relative' }} data-variant-image-menu-wrapper="true">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-light"
                                  onClick={() =>
                                    setOpenVariantImageMenuUUID((prev) => (prev === img.uuid ? '' : img.uuid))
                                  }
                                  disabled={
                                    variantImagesUploading ||
                                    variantImageUpdatingUUID === img.uuid ||
                                    productFeaturedUpdatingUUID === img.uuid
                                  }
                                  title="More actions"
                                >
                                  &#8942;
                                </button>
                                {openVariantImageMenuUUID === img.uuid ? (
                                  <div
                                    data-variant-image-menu-wrapper="true"
                                    className="border rounded bg-white shadow-sm"
                                    style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: 'auto',
                                      bottom: '36px',
                                      minWidth: '220px',
                                      zIndex: 99999,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-left w-100"
                                      onClick={async () => {
                                        setOpenVariantImageMenuUUID('');
                                        await onUpdateVariantImage(selectedVariant?.uuid, img, !img?.isFeatured);
                                      }}
                                      disabled={variantImageUpdatingUUID === img.uuid}
                                    >
                                      {img?.isFeatured ? 'Unset Variant Featured' : 'Set Variant Featured'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-left w-100"
                                      onClick={async () => {
                                        setOpenVariantImageMenuUUID('');
                                        await onUpdateProductFeaturedImage(selectedVariant?.uuid, img.uuid);
                                      }}
                                      disabled={productFeaturedUpdatingUUID === img.uuid}
                                    >
                                      {isProductFeatured ? 'Current Product Featured' : 'Set as Product Featured'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm text-left w-100 text-danger"
                                      onClick={async () => {
                                        setOpenVariantImageMenuUUID('');
                                        await onDeleteVariantImage(selectedVariant?.uuid, img.uuid);
                                      }}
                                      disabled={variantImagesUploading}
                                    >
                                      Delete Image
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="d-flex justify-content-between align-items-center" style={{ gap: '8px' }}>
                              <small className="text-muted" style={{ wordBreak: 'break-all' }}>
                                {img.uuid}
                              </small>                             
                            </div>
                          </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => {
                      setShowVariantImagesModal(false);
                      setOpenVariantImageMenuUUID('');
                      setVariantImages([]);
                      setVariantImagesError('');
                    }}
                    disabled={variantImagesUploading}
                  >
                    Close
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
