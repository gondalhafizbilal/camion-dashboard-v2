'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getProxyImageUrl, getTransformedImageUrl, proxyHtmlImageSources } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function buildProcurementProductSlug(title, externalId) {
  const normalizedExternalId = String(externalId || '').trim() || String(Date.now());
  const suffix = `-${normalizedExternalId}`;
  const maxTotalLength = 62;
  const maxBaseLength = Math.max(1, maxTotalLength - suffix.length);
  const base = slugify(title).slice(0, maxBaseLength);
  return `${base}${suffix}`.slice(0, maxTotalLength);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function toPositiveNumber(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed <= 0) return fallback;
  if (parsed > 0 && parsed < 1) return 1;
  return parsed;
}

function toPositiveInteger(value, fallback = 1) {
  const normalized = toPositiveNumber(value, fallback);
  return Math.max(1, Math.ceil(normalized));
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function matchesProcurementId(product, externalId) {
  const target = String(externalId || '').trim();
  if (!target) return false;
  const candidates = [
    product?.procurementId,
    product?.procurement_id,
    product?.externalId,
    product?.external_id,
  ];
  return candidates.some((value) => String(value || '').trim() === target);
}

function get1688OfferUrl(procurementId) {
  const value = String(procurementId || '').trim();
  return value ? `https://detail.1688.com/offer/${encodeURIComponent(value)}.html` : '';
}

function getDefaultMoveQuantity(stock) {
  const stockCount = Math.max(0, safeInteger(stock, 0));
  if (stockCount > 100) return '100';
  if (stockCount === 0) return '0';
  return String(Math.max(1, Math.floor(stockCount * 0.5)));
}

function toProcurementVariantTitle(baseTitle, suffix = '') {
  return `${String(baseTitle || '').trim()} ${String(suffix || '').trim()}`.trim().slice(0, 100);
}

function trimOptionText(value) {
  return String(value || '').trim().slice(0, 64);
}

function isValidHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isUUIDv4(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function normalizeFeaturedSelection(imageItems) {
  const list = Array.isArray(imageItems) ? imageItems : [];
  let featuredFound = false;
  return list.map((item) => {
    const selected = Boolean(item?.selected);
    const shouldFeature = selected && Boolean(item?.isMain) && !featuredFound;
    if (shouldFeature) featuredFound = true;
    return {
      ...item,
      selected,
      isMain: shouldFeature,
    };
  });
}

export default function ProcurementShowPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.productId;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [rawProduct, setRawProduct] = useState(null);

  const [form, setForm] = useState({
    externalId: '',
    title: '',
    brief: '',
    description: '',
    descriptionTrans: '',
    price: '0',
    minOrderQuantity: '1',
    video: '',
    supplierName: '',
    supplierId: '',
    shopId: '',
    shopName: '',
    currencyCode: 'cny',
    categoryJson: '{\n  "level1": "",\n  "level2": "",\n  "level3": ""\n}',
    shippingJson: '{\n  "weight": 1,\n  "length": 1,\n  "width": 1,\n  "height": 1,\n  "origin": ""\n}',
    metaJson: '{\n  "rating": 0,\n  "sold": 0,\n  "isDropshipping": false\n}',
    optionsJson: '[]',
    attributesJson: '[]',
  });

  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [groupByAttribute, setGroupByAttribute] = useState('');
  const descriptionEditorRef = useRef(null);

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

      // Only set JSON content-type when the payload is JSON.
      // This keeps behavior consistent with other pages and avoids breaking FormData.
      if (options.body !== undefined && !headers.has('Content-Type') && typeof options.body === 'string') {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          Array.isArray(payload?.message) ? payload.message.filter(Boolean).join('; ') : payload?.message;
        const backendError =
          payload?.errors?.error || payload?.errors?.slug || message || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadWarehouses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/warehouses?itemsPerPage=100&pageNumber=1', { method: 'GET' });
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setWarehouses(list);
      if (list.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(list[0].uuid);
      }
    } catch {
      setWarehouses([]);
    }
  }, [apiFetch, selectedWarehouse, token]);

  const loadCategories = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch('/api/categories?itemsPerPage=100&pageNumber=1', { method: 'GET' });
      const list = Array.isArray(data) ? data : [];
      setCategoryTree(list);
      setSelectedCategoryPath([]);
    } catch {
      setCategoryTree([]);
      setSelectedCategoryPath([]);
    }
  }, [apiFetch, token]);

  const loadProduct = useCallback(async () => {
    if (!token || !productId) return;
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(`/api/procurement/${productId}`, { method: 'GET' });
      setRawProduct(data || null);

      const product = data || {};
      setForm({
        externalId: String(product.externalId || ''),
        title: product.title || '',
        description: product.description || '',
        descriptionTrans: product.descriptionTrans || '',
        price: String(product.price ?? 0),
        minOrderQuantity: String(product.minOrderQuantity ?? 1),
        video: product.video || '',
        supplierName: product?.supplier?.name || '',
        supplierId: product?.supplier?.id || '',
        shopId: product?.shopId || product?.supplier?.id || '',
        shopName: product?.shopName || product?.supplier?.name || '',
        currencyCode: String(product?.currencyCode || 'cny').toLowerCase(),
        categoryJson: JSON.stringify(product?.category || {}, null, 2),
        shippingJson: JSON.stringify(product?.shipping || {}, null, 2),
        metaJson: JSON.stringify(product?.meta || {}, null, 2),
        optionsJson: JSON.stringify(product?.options || [], null, 2),
        attributesJson: JSON.stringify(product?.attributes || [], null, 2),
      });

      const imageList = Array.isArray(product.images) ? product.images : [];
      const initialImages = imageList.map((url) => ({
        url: getTransformedImageUrl(url),
        selected: true,
        isMain: getTransformedImageUrl(url) === getTransformedImageUrl(product.mainImage),
      }));
      const normalizedInitialImages = normalizeFeaturedSelection(initialImages);
      if (!normalizedInitialImages.some((img) => img.isMain) && normalizedInitialImages.length > 0) {
        normalizedInitialImages[0].isMain = true;
      }
      setImages(normalizedInitialImages);

      const variantList = Array.isArray(product.variants) ? product.variants : [];
      setVariants(
        variantList.map((variant, index) => ({
          ...variant,
          rowKey: `${variant?.skuId || 'variant'}-${index}`,
          selected: true,
          moveQuantity: getDefaultMoveQuantity(variant?.stock),
          price: String(variant.price ?? 0),
          image: getTransformedImageUrl(variant.image),
          imageSelected: Boolean(variant.image),
        }))
      );

      const firstAttributeName =
        variantList.find((variant) => Array.isArray(variant?.attributes) && variant.attributes.length > 0)?.attributes?.[0]?.name || '';
      setGroupByAttribute(firstAttributeName ? String(firstAttributeName) : '');
    } catch (err) {
      setError(err.message || 'Failed to load product details.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, productId, token]);

  useEffect(() => {
    loadProduct();
    loadWarehouses();
    loadCategories();
  }, [loadCategories, loadProduct, loadWarehouses]);

  useEffect(() => {
    if (!descriptionEditorRef.current) return;
    const next = form.description || '';
    if (descriptionEditorRef.current.innerHTML !== next) {
      descriptionEditorRef.current.innerHTML = next;
    }
  }, [form.description]);

  const variantAttributeNames = useMemo(() => {
    const names = new Set();
    variants.forEach((variant) => {
      if (!Array.isArray(variant?.attributes)) return;
      variant.attributes.forEach((attr) => {
        const name = String(attr?.name || '').trim();
        if (name) names.add(name);
      });
    });
    return Array.from(names);
  }, [variants]);

  const categoryLevels = useMemo(() => {
    const levels = [];
    let currentOptions = Array.isArray(categoryTree) ? categoryTree : [];
    let levelIndex = 0;

    while (Array.isArray(currentOptions) && currentOptions.length > 0) {
      const selectedUUID = selectedCategoryPath[levelIndex] || '';
      levels.push({ options: currentOptions, selectedUUID });

      const selectedNode = currentOptions.find((category) => category.uuid === selectedUUID);
      if (!selectedNode || !Array.isArray(selectedNode.children) || selectedNode.children.length === 0) {
        break;
      }

      currentOptions = selectedNode.children;
      levelIndex += 1;
    }

    return levels;
  }, [categoryTree, selectedCategoryPath]);

  const selectedLeafCategoryUUID = useMemo(() => {
    for (let index = selectedCategoryPath.length - 1; index >= 0; index -= 1) {
      if (selectedCategoryPath[index]) return selectedCategoryPath[index];
    }
    return '';
  }, [selectedCategoryPath]);

  const groupedVariants = useMemo(() => {
    const groups = new Map();

    variants.forEach((variant) => {
      const attributes = Array.isArray(variant?.attributes) ? variant.attributes : [];
      const selectedGroupAttribute = String(groupByAttribute || '').trim();
      const groupingAttribute = selectedGroupAttribute || (attributes[0] ? String(attributes[0].name || '').trim() : '');
      const matchedAttribute = attributes.find((attr) => String(attr?.name || '').trim() === groupingAttribute);
      const groupValue = String(matchedAttribute?.value || '').trim();

      const groupKey = groupingAttribute
        ? `${groupingAttribute.toUpperCase()} - ${groupValue || 'N/A'}`
        : 'NO ATTRIBUTES';

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey).push(variant);
    });

    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }, [groupByAttribute, variants]);

  const allVariantsSelected = variants.length > 0 && variants.every((variant) => variant.selected);

  const updateVariantField = useCallback((rowKey, field, value) => {
    setVariants((prev) => prev.map((item) => (item.rowKey === rowKey ? { ...item, [field]: value } : item)));
  }, []);

  const onCategoryLevelChange = useCallback((levelIndex, uuid) => {
    setSelectedCategoryPath((prev) => {
      const next = prev.slice(0, levelIndex);
      next[levelIndex] = uuid;
      return next;
    });
  }, []);

  const applyDescriptionFormat = useCallback((command, value = null) => {
    if (!descriptionEditorRef.current) return;
    descriptionEditorRef.current.focus();
    document.execCommand(command, false, value);
    setForm((prev) => ({ ...prev, description: descriptionEditorRef.current.innerHTML }));
  }, []);

  const onSaveToStore = async () => {
    const warehouseUUIDToUse = selectedWarehouse || warehouses[0]?.uuid || '';
    if (!warehouseUUIDToUse) {
      setError('No warehouse available. Create a warehouse first.');
      return;
    }

    if (!selectedWarehouse && warehouseUUIDToUse) {
      setSelectedWarehouse(warehouseUUIDToUse);
    }

    const externalId = String(form.externalId || '').trim();
    if (!externalId) {
      setError('External ID is required before saving to store.');
      return;
    }

    setError('');
    setMessage('');
    try {
      const filters = encodeURIComponent(JSON.stringify({ procurementId: externalId }));
      const maybeExisting = await apiFetch(`/api/products?itemsPerPage=20&pageNumber=1&filters=${filters}`, { method: 'GET' });
      const existingList = Array.isArray(maybeExisting)
        ? maybeExisting
        : Array.isArray(maybeExisting?.items)
          ? maybeExisting.items
          : Array.isArray(maybeExisting?.data)
            ? maybeExisting.data
            : [];

      let existingProduct = existingList.find((item) => matchesProcurementId(item, externalId));

      if (!existingProduct) {
        const fallbackFilters = encodeURIComponent(JSON.stringify({ query: externalId }));
        const fallbackRes = await apiFetch(`/api/products?itemsPerPage=100&pageNumber=1&filters=${fallbackFilters}`, { method: 'GET' });
        const fallbackList = Array.isArray(fallbackRes)
          ? fallbackRes
          : Array.isArray(fallbackRes?.items)
            ? fallbackRes.items
            : Array.isArray(fallbackRes?.data)
              ? fallbackRes.data
              : [];
        existingProduct = fallbackList.find((item) => matchesProcurementId(item, externalId));
      }

      if (existingProduct) {
        setError(
          `This procurement product is already imported (procurementId: ${externalId}). Product UUID: ${existingProduct?.uuid || 'N/A'}`
        );
        return;
      }
    } catch (precheckErr) {
      setError(precheckErr.message || 'Failed to validate existing product before import.');
      return;
    }

    setSaving(true);
    setSaveProgress(0);

    try {
      const optionsParsed = safeJsonParse(form.optionsJson, []);
      const shippingParsed = safeJsonParse(form.shippingJson, {});
      const selectedImages = images.filter((image) => image.selected);
      const selectedVariants = variants.filter((variant) => variant.selected && safeNumber(variant.moveQuantity, 0) > 0);
      const selectedImagesWithUrl = selectedImages
        .map((image) => ({
          url: String(image?.url || '').trim(),
          isFeatured: Boolean(image?.isMain),
        }))
        .filter((image) => image.url);
      const invalidGalleryImage = selectedImagesWithUrl.find((image) => !isValidHttpUrl(image.url));
      const validOptions = Array.isArray(optionsParsed)
        ? optionsParsed
            .map((option, optionIndex) => ({
              optionIndex,
              optionName: trimOptionText(option?.name),
              values: Array.isArray(option?.values)
                ? option.values.map((value) => trimOptionText(value)).filter(Boolean)
                : [],
            }))
            .filter((option) => option.optionName)
        : [];

      const selectedCategoryUUIDs = selectedCategoryPath
        .map((value) => String(value || '').trim())
        .filter((value) => isUUIDv4(value));

      if (selectedCategoryUUIDs.length === 0) {
        setError('Please select a category before saving to store.');
        return;
      }
      if (!isUUIDv4(warehouseUUIDToUse)) {
        setError('Selected warehouse UUID is invalid.');
        return;
      }
      if (selectedVariants.length === 0) {
        setError('Please select at least one variant with quantity greater than 0.');
        return;
      }
      if (invalidGalleryImage) {
        setError(`Invalid selected gallery image URL: ${invalidGalleryImage.url}`);
        return;
      }

      const selectedVariantsPrepared = selectedVariants.map((variant) => {
        const imageUrl = String(variant?.image || '').trim();
        return {
          variant,
          imageUrl,
        };
      });
      const invalidVariantImage = selectedVariantsPrepared.find(({ imageUrl }) => !isValidHttpUrl(imageUrl));
      if (invalidVariantImage) {
        setError('Every selected variant must have a valid image URL (http/https).');
        return;
      }

      const featuredSelectedImages = selectedImagesWithUrl.filter((image) => image.isFeatured);
      if (featuredSelectedImages.length > 1) {
        setError('Only one featured image is allowed.');
        return;
      }

      const preferredDescription = form.descriptionTrans?.trim() || form.description?.trim() || form.title?.trim();
      const normalizedTitle = form.title.trim();
      const normalizedBrief = String(form.brief || '').trim() || normalizedTitle;
      const normalizedDescription = preferredDescription;
      const normalizedDescriptionHtml = form.description || preferredDescription;
      setSaveProgress(30);

      const payload = {
        items: [
          {
            externalId: String(externalId),
            slug: buildProcurementProductSlug(form.title, form.externalId).slice(0, 64),
            title: {
              en: normalizedTitle,
              ar: normalizedTitle,
            },
            brief: {
              en: normalizedBrief,
              ar: normalizedBrief,
            },
            description: {
              en: normalizedDescription,
              ar: normalizedDescription,
            },
            descriptionHtml: {
              en: normalizedDescriptionHtml,
              ar: normalizedDescriptionHtml,
            },
            categories: selectedCategoryUUIDs,
            shopId: form.shopId || undefined,
            shopName: form.shopName || undefined,
            warehouseUUID: warehouseUUIDToUse,
            options: validOptions.map((option) => ({
              name: {
                en: option.optionName,
                ar: option.optionName,
              },
              position: option.optionIndex,
              values: option.values.map((value, index) => ({
                value: {
                  en: value,
                  ar: value,
                },
                position: index,
              })),
            })),
            variants: selectedVariantsPrepared.map(({ variant, imageUrl }) => {
              const attributes = Array.isArray(variant?.attributes) ? variant.attributes : [];
              const titleSuffix = attributes
                .map((attr) => String(attr?.value || '').trim())
                .filter(Boolean)
                .join(' ');
              const variantTitleEn = toProcurementVariantTitle(form.title, titleSuffix);

              return {
                title: {
                  en: variantTitleEn,
                  ar: variantTitleEn,
                },
                sku: String(variant?.skuId || variant?.externalId || `${form.externalId}-${Date.now()}`),
                barcode: String(variant?.skuId || variant?.externalId || `${Date.now()}`),
                quantity: toPositiveInteger(variant.moveQuantity, 1),
                cost: {
                  amount: toPositiveNumber(variant.price, 1),
                  currencyCode: String(form.currencyCode || 'cny').toLowerCase(),
                },
                weight: {
                  amount: toPositiveNumber(variant?.shipping?.weight, toPositiveNumber(shippingParsed?.weight, 1)),
                  unit: 'kg',
                },
                dimensions: {
                  width: toPositiveNumber(variant?.shipping?.width, toPositiveNumber(shippingParsed?.width, 1)),
                  height: toPositiveNumber(variant?.shipping?.height, toPositiveNumber(shippingParsed?.height, 1)),
                  length: toPositiveNumber(variant?.shipping?.length, toPositiveNumber(shippingParsed?.length, 1)),
                  unit: 'mm',
                },
                optionValues: [],
                imageUrl,
                attributes: attributes.map((attr) => ({
                  optionNameEn: trimOptionText(attr?.name),
                  optionNameAr: trimOptionText(attr?.name),
                  optionValueEn: trimOptionText(attr?.value),
                  optionValueAr: trimOptionText(attr?.value),
                })),
                skuMeta: variant?.skuMeta || null,
              };
            }),
            images:
              selectedImagesWithUrl.length > 0
                ? (() => {
                    const firstFeaturedIndex = selectedImagesWithUrl.findIndex((image) => image.isFeatured);
                    const featuredIndex = firstFeaturedIndex >= 0 ? firstFeaturedIndex : 0;
                    return selectedImagesWithUrl.map((image, index) => ({
                      url: image.url,
                      isFeatured: index === featuredIndex,
                    }));
                  })()
                : [],
          },
        ],
      };

      const response = await apiFetch('/api/procurement/save', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSaveProgress(100);

      const successList = Array.isArray(response?.success) ? response.success : [];
      const failedList = Array.isArray(response?.failed) ? response.failed : [];
      const firstProductUUID = successList[0]?.uuid || successList[0]?.product?.uuid || '';

      setMessage(`Save completed. Success: ${successList.length}, Failed: ${failedList.length}.`);
      if (firstProductUUID) {
        router.push(`/products/${firstProductUUID}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to save to store.');
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading procurement product...</div>;
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
                  <h4 className="card-title mb-0">Procurement Product Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    {form.externalId ? (
                      <a
                        href={get1688OfferUrl(form.externalId)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline-secondary btn-sm"
                      >
                        View on 1688
                      </a>
                    ) : null}
                    <Link href="/procurement" className="btn btn-outline-primary btn-sm">
                      Back to Search
                    </Link>
                    <button className="btn btn-primary btn-sm" type="button" onClick={onSaveToStore} disabled={saving || loading}>
                      {saving ? 'Saving...' : 'Save to Store'}
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {saving ? (
                    <div className="alert alert-info" role="status">
                      Saving to store... {saveProgress}%
                    </div>
                  ) : null}
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  {loading ? <p className="mb-0">Loading product details...</p> : null}

                  {!loading && rawProduct ? (
                    <>
                      <div className="table-responsive mb-4">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: '220px' }}>External ID</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.externalId}
                                  readOnly
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Title</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.title}
                                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Brief</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.brief}
                                  onChange={(e) => setForm((prev) => ({ ...prev, brief: e.target.value }))}
                                  placeholder="Optional brief for product"
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Price</th>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={form.price}
                                  readOnly
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Currency</th>
                              <td>
                                <input className="form-control" value={String(form.currencyCode || 'cny').toUpperCase()} readOnly />
                              </td>
                            </tr>
                            <tr>
                              <th>Min Order Quantity</th>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={form.minOrderQuantity}
                                  onChange={(e) => setForm((prev) => ({ ...prev, minOrderQuantity: e.target.value }))}
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Warehouse (for variants)</th>
                              <td>
                                <select
                                  className="form-control"
                                  value={selectedWarehouse}
                                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                                >
                                  <option value="">Select warehouse</option>
                                  {warehouses.map((warehouse) => (
                                    <option key={warehouse.uuid} value={warehouse.uuid}>
                                      {warehouse.name || warehouse.code || warehouse.uuid}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                            <tr>
                              <th>Supplier Name</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.supplierName}
                                  readOnly
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Supplier ID</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.supplierId}
                                  readOnly
                                />
                              </td>
                            </tr>
                            <tr>
                              <th>Video</th>
                              <td>
                                <input
                                  className="form-control"
                                  value={form.video}
                                  onChange={(e) => setForm((prev) => ({ ...prev, video: e.target.value }))}
                                />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <h5 className="mb-2">Description HTML (Editable)</h5>
                      <div className="border rounded mb-3">
                        <div className="p-2 border-bottom d-flex flex-wrap" style={{ gap: '6px' }}>
                          <button type="button" className="btn btn-light btn-sm" onClick={() => applyDescriptionFormat('bold')}>
                            Bold
                          </button>
                          <button type="button" className="btn btn-light btn-sm" onClick={() => applyDescriptionFormat('italic')}>
                            Italic
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => applyDescriptionFormat('underline')}
                          >
                            Underline
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => applyDescriptionFormat('insertUnorderedList')}
                          >
                            Bullet List
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => applyDescriptionFormat('insertOrderedList')}
                          >
                            Numbered List
                          </button>
                          <button
                            type="button"
                            className="btn btn-light btn-sm"
                            onClick={() => {
                              const url = window.prompt('Enter link URL');
                              if (url) applyDescriptionFormat('createLink', url);
                            }}
                          >
                            Link
                          </button>
                          <button type="button" className="btn btn-light btn-sm" onClick={() => applyDescriptionFormat('removeFormat')}>
                            Clear Format
                          </button>
                        </div>
                        <div
                          ref={descriptionEditorRef}
                          className="p-3"
                          contentEditable
                          suppressContentEditableWarning
                          style={{ minHeight: '220px', maxHeight: '800px', overflowY: 'auto', outline: 'none' }}
                          onInput={(e) => setForm((prev) => ({ ...prev, description: e.currentTarget.innerHTML }))}
                        />
                      </div>

                      <h6 className="mb-2">Description Preview (iframe style)</h6>
                          <iframe
                        title="procurement-description-preview"
                        srcDoc={proxyHtmlImageSources(form.description || '<p>No description</p>')}
                        style={{ width: '100%', minHeight: '420px', border: '1px solid #d9d9d9', borderRadius: '8px' }}
                      />

                      <h5 className="mt-4 mb-2">Description (Translated / Text)</h5>
                      <textarea
                        className="form-control mb-4"
                        rows={4}
                        value={form.descriptionTrans}
                        onChange={(e) => setForm((prev) => ({ ...prev, descriptionTrans: e.target.value }))}
                      />

                      <h5 className="mb-3">Images (Selectable)</h5>
                      <div className="row mb-4">
                        {images.map((image, index) => (
                          <div className="col-md-3 mb-3" key={image.url}>
                            <div className="border rounded p-2 h-100">
                              <img
                                src={getProxyImageUrl(getTransformedImageUrl(image.url))}
                                alt="product"
                                style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                              />
                              <div className="mt-2 d-flex align-items-center" style={{ gap: '8px' }}>
                                <input
                                  type="checkbox"
                                  checked={image.selected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setImages((prev) => {
                                      const next = prev.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, selected: checked, isMain: checked ? item.isMain : false } : item
                                      );
                                      const normalized = normalizeFeaturedSelection(next);
                                      const hasFeatured = normalized.some((item) => item.isMain);
                                      if (!hasFeatured) {
                                        const firstSelectedIndex = normalized.findIndex((item) => item.selected);
                                        if (firstSelectedIndex >= 0) normalized[firstSelectedIndex].isMain = true;
                                      }
                                      return normalized;
                                    });
                                  }}
                                />
                                <span>Select</span>
                              </div>
                              <div className="mt-1 d-flex align-items-center" style={{ gap: '8px' }}>
                                <input
                                  type="radio"
                                  name="featuredImage"
                                  checked={image.isMain}
                                  disabled={!image.selected}
                                  onChange={() => {
                                    setImages((prev) =>
                                      prev.map((item, itemIndex) => ({
                                        ...item,
                                        isMain: item.selected && itemIndex === index,
                                      }))
                                    );
                                  }}
                                />
                                <span>Featured Image</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <h5 className="mb-3">Variants (Selectable + Move Quantity)</h5>
                      {variants.length > 0 ? (
                        <>
                          <div className="d-flex justify-content-between align-items-center mb-2" style={{ gap: '8px' }}>
                            <div className="d-flex align-items-center" style={{ gap: '8px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>Group by:</span>
                              <select
                                className="form-control form-control-sm"
                                style={{ minWidth: '220px' }}
                                value={groupByAttribute}
                                onChange={(e) => setGroupByAttribute(e.target.value)}
                              >
                                <option value="">Auto (first attribute)</option>
                                {variantAttributeNames.map((attributeName) => (
                                  <option key={attributeName} value={attributeName}>
                                    {attributeName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => {
                                const nextSelectedState = !allVariantsSelected;
                                setVariants((prev) => prev.map((item) => ({ ...item, selected: nextSelectedState })));
                              }}
                            >
                              {allVariantsSelected ? 'Deselect All Variants' : 'Select All Variants'}
                            </button>
                          </div>
                          {groupedVariants.map((group) => (
                            <div className="table-responsive mb-4" key={group.name}>
                              <h6 className="mb-2">{group.name}</h6>
                              <table className="table table-striped mb-0">
                                <thead>
                                  <tr>
                                    <th>Select</th>
                                    <th>Image</th>
                                    <th>SKU ID</th>
                                    <th>Price</th>
                                    <th>Stock</th>
                                    <th>Attributes</th>
                                    <th>Move Quantity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.items.map((variant) => (
                                    <tr key={variant.rowKey}>
                                      <td>
                                        <input
                                          type="checkbox"
                                          checked={variant.selected}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            updateVariantField(variant.rowKey, 'selected', checked);
                                          }}
                                        />
                                      </td>
                                      <td>
                                        {variant.image ? (
                                          <img
                                            src={getProxyImageUrl(getTransformedImageUrl(variant.image))}
                                            alt="variant"
                                            style={{ width: '52px', height: '52px', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          '-'
                                        )}
                                      </td>
                                      <td>{variant.skuId}</td>
                                      <td>
                                        <input
                                          type="number"
                                          step="any"
                                          className="form-control"
                                          value={String(variant.price ?? '')}
                                          readOnly
                                          style={{ minWidth: '110px' }}
                                        />
                                      </td>
                                      <td>{variant.stock}</td>
                                      <td>
                                        {(variant.attributes || [])
                                          .filter((attr) => String(attr?.name || '').trim() !== String(groupByAttribute || '').trim())
                                          .map((attr) => `${attr.name}: ${attr.value}`)
                                          .join(', ') || '-'}
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          className="form-control"
                                          value={String(variant.moveQuantity ?? '')}
                                          onChange={(e) => {
                                            updateVariantField(variant.rowKey, 'moveQuantity', e.target.value);
                                          }}
                                          style={{ minWidth: '120px' }}
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </>
                      ) : (
                        <p className="mb-4">No variants found.</p>
                      )}

                      <div className="row mt-1" style={{ clear: 'both' }}>
                        <div className="col-12">
                          <div className="card border mb-4" style={{ position: 'relative', zIndex: 1 }}>
                            <div className="card-header py-2">
                              <h5 className="mb-0">Category Selection</h5>
                            </div>
                            <div className="card-body">
                              {categoryLevels.length === 0 ? (
                                <p className="mb-0">No categories available.</p>
                              ) : (
                                <>
                                  <p className="text-muted mb-3">
                                    Select parent category first, then keep selecting child categories until the deepest level.
                                  </p>
                                  <div className="row">
                                    {categoryLevels.map((level, levelIndex) => (
                                      <div className="col-md-4 mb-3" key={`category-level-${levelIndex}`}>
                                        <label className="form-label">Level {levelIndex + 1}</label>
                                        <select
                                          className="form-control"
                                          value={level.selectedUUID}
                                          onChange={(e) => onCategoryLevelChange(levelIndex, e.target.value)}
                                        >
                                          <option value="">Select category</option>
                                          {level.options.map((category) => (
                                            <option key={category.uuid} value={category.uuid}>
                                              {category.name || category.nameEn || category.slug || category.uuid}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="alert alert-light mb-0">
                                    <strong>Selected category UUID:</strong> {selectedLeafCategoryUUID || 'None'}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
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
