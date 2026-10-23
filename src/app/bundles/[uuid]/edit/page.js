"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import NavHeader from "@/components/NavHeader";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import BundleForm, {
  createEmptyBundleItem,
  normalizeBundleErrors,
} from "@/components/bundles/BundleForm";
import { clearAuth, getStoredAuth, isAuthValid } from "@/lib/auth";
import { toApiError } from "@/lib/apiError";
import { getTransformedImageUrl } from "@/lib/imageUrl";

function getUserRole(user) {
  return (
    user?.role?.name || user?.roleName || user?.role || user?.userRole || "user"
  );
}

function getUserName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User"
  );
}

function toLocalDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EditBundlePage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;
  const [menuToggled, setMenuToggled] = useState(false);
  const [variantOptionsByProduct, setVariantOptionsByProduct] = useState({});
  const [selectedProductsByUuid, setSelectedProductsByUuid] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedSourceCategories, setSelectedSourceCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [bundle, setBundle] = useState(null);
  const [formData, setFormData] = useState({
    titleEn: "",
    titleAr: "",
    briefEn: "",
    briefAr: "",
    slug: "",
    discountType: "percentage_off",
    flatPriceValue: "",
    discountPercentage: "",
    discountAmountValue: "",
    amountCurrencyCode: "qar",
    mode: "fixed",
    anchorProductUuid: "",
    autoFillCount: "1",
    isActive: true,
    startsAt: "",
    finishesAt: "",
    items: [createEmptyBundleItem(), createEmptyBundleItem()],
  });

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || "";

  useEffect(() => {
    if (!isValid) {
      clearAuth();
      router.replace("/login");
      return;
    }
    const body = document.body;
    body.setAttribute(
      "data-sidebar-style",
      window.innerWidth <= 768 ? "overlay" : "full",
    );
    const onResize = () =>
      body.setAttribute(
        "data-sidebar-style",
        window.innerWidth <= 768 ? "overlay" : "full",
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isValid, router]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("authorization", `Bearer ${token}`);
      if (
        options.body !== undefined &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
      )
        headers.set("Content-Type", "application/json");
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw toApiError(payload, response, "Request failed.");
      return payload;
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await apiFetch("/api/categories?itemsPerPage=500&pageNumber=1", {
          method: "GET",
        });
        setCategoryOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Failed to load categories.");
      }
    })();
  }, [apiFetch, token]);

  const rememberSelectedProduct = useCallback((product) => {
    if (!product?.uuid) return;
    setSelectedProductsByUuid((prev) => ({
      ...prev,
      [product.uuid]: product,
    }));
  }, []);

  const loadVariants = useCallback(
    async (productUuid) => {
      if (!productUuid || variantOptionsByProduct[productUuid]) return;
      try {
        const data = await apiFetch(
          `/api/products/${productUuid}/variants?pageNumber=1&itemsPerPage=100`,
          { method: "GET" },
        );
        setVariantOptionsByProduct((prev) => ({
          ...prev,
          [productUuid]: Array.isArray(data) ? data : [],
        }));
      } catch (err) {
        setError(err.message || "Failed to load variants.");
      }
    },
    [apiFetch, variantOptionsByProduct],
  );

  useEffect(() => {
    if (!token || !uuid) return;
    (async () => {
      try {
        const bundleData = await apiFetch(`/api/bundles/${uuid}`, {
          method: "GET",
        });
        setBundle(bundleData || null);
        const items =
          Array.isArray(bundleData?.items) && bundleData.items.length > 0
            ? bundleData.items.map((item) => ({
                productUuid:
                  item?.product?.uuid || item?.variant?.product?.uuid || "",
                variantUuid: item?.variant?.uuid || "",
                quantity: String(item?.quantity ?? 1),
              }))
            : [createEmptyBundleItem(), createEmptyBundleItem()];

        const selectedProducts = {};
        items.forEach((item, index) => {
          const bundleItem = bundleData?.items?.[index];
          const product =
            bundleItem?.product || bundleItem?.variant?.product || null;
          if (product?.uuid) {
            selectedProducts[product.uuid] = product;
          }
        });
        setSelectedProductsByUuid(selectedProducts);
        if (bundleData?.anchorProductUuid && !selectedProducts[bundleData.anchorProductUuid]) {
          selectedProducts[bundleData.anchorProductUuid] = {
            uuid: bundleData.anchorProductUuid,
            titleEn: "Selected anchor product",
          };
        }
        setSelectedSourceCategories(
          Array.isArray(bundleData?.sourceCategoryUuids)
            ? bundleData.sourceCategoryUuids
            : [],
        );

        setFormData({
          titleEn: bundleData?.titleEn || "",
          titleAr: bundleData?.titleAr || "",
          briefEn: bundleData?.briefEn || "",
          briefAr: bundleData?.briefAr || "",
          slug: bundleData?.slug || "",
          discountType: bundleData?.discountType || "percentage_off",
          flatPriceValue: bundleData?.flatPriceValue ?? "",
          discountPercentage: bundleData?.discountPercentage ?? "",
          discountAmountValue: bundleData?.discountAmountValue ?? "",
          amountCurrencyCode: bundleData?.amountCurrencyCode || "qar",
          mode: bundleData?.mode || "fixed",
          anchorProductUuid: bundleData?.anchorProductUuid || "",
          autoFillCount: String(bundleData?.autoFillCount ?? 1),
          isActive: Boolean(bundleData?.isActive),
          startsAt: toLocalDateTimeValue(bundleData?.startsAt),
          finishesAt: toLocalDateTimeValue(bundleData?.finishesAt),
          items,
        });

        await Promise.all(
          items.map((item) =>
            item.productUuid
              ? loadVariants(item.productUuid)
              : Promise.resolve(),
          ),
        );
      } catch (err) {
        setError(err.message || "Failed to load bundle.");
      }
    })();
  }, [apiFetch, token, uuid, loadVariants]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => {
      const nextValue = type === "checkbox" ? checked : value;
      const next = {
        ...prev,
        [name]: nextValue,
      };
      if (name === "mode") {
        if (value === "fixed") {
          next.anchorProductUuid = "";
          next.autoFillCount = "1";
          setSelectedSourceCategories([]);
          if (prev.items.length < 2) {
            next.items = [createEmptyBundleItem(), createEmptyBundleItem()];
          }
        } else if (value === "auto") {
          next.items = [];
        } else if (value === "hybrid" && prev.items.length === 0) {
          next.items = [createEmptyBundleItem()];
        }
      }
      return next;
    });
  };

  const onItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const onSelectItemProduct = useCallback(
    (index, product) => {
      const nextProductUuid = product?.uuid || "";

      setFormData((prev) => ({
        ...prev,
        items: prev.items.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                productUuid: nextProductUuid,
                variantUuid: "",
              }
            : item,
        ),
      }));

      if (product?.uuid) {
        rememberSelectedProduct(product);
        loadVariants(product.uuid);
      }
    },
    [loadVariants, rememberSelectedProduct],
  );

  const onAddItem = () =>
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyBundleItem()],
    }));
  const onRemoveItem = (index) =>
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const onToggleSourceCategory = useCallback((categoryUuid) => {
    setSelectedSourceCategories((prev) =>
      prev.includes(categoryUuid)
        ? prev.filter((uuid) => uuid !== categoryUuid)
        : [...prev, categoryUuid],
    );
  }, []);

  const onSelectAnchorProduct = useCallback(
    (product) => {
      const nextProductUuid = product?.uuid || "";
      setFormData((prev) => ({
        ...prev,
        anchorProductUuid: nextProductUuid,
      }));
      if (product?.uuid) {
        rememberSelectedProduct(product);
      }
    },
    [rememberSelectedProduct],
  );

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    try {
      await apiFetch(`/api/bundles/${uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          title: { en: formData.titleEn.trim(), ar: formData.titleAr.trim() },
          brief: { en: formData.briefEn.trim(), ar: formData.briefAr.trim() },
          slug: formData.slug.trim(),
          discountType: formData.discountType,
          mode: formData.mode,
          flatPriceValue:
            formData.discountType === "flat_total"
              ? Number(formData.flatPriceValue)
              : undefined,
          discountPercentage:
            formData.discountType === "percentage_off"
              ? Number(formData.discountPercentage)
              : undefined,
          discountAmountValue:
            formData.discountType === "fixed_amount_off"
              ? Number(formData.discountAmountValue)
              : undefined,
          amountCurrencyCode:
            formData.discountType === "percentage_off"
              ? undefined
              : formData.amountCurrencyCode,
          anchorProductUuid:
            formData.mode === "fixed" ? undefined : formData.anchorProductUuid || undefined,
          sourceCategoryUuids:
            formData.mode === "fixed" || selectedSourceCategories.length === 0
              ? undefined
              : selectedSourceCategories,
          autoFillCount:
            formData.mode === "fixed" ? undefined : Number(formData.autoFillCount || 1),
          isActive: Boolean(formData.isActive),
          startsAt: formData.startsAt,
          finishesAt: formData.finishesAt,
          items:
            formData.mode === "auto"
              ? []
              : formData.items.map((item) => ({
                  productUuid: item.productUuid || undefined,
                  variantUuid: item.variantUuid || undefined,
                  quantity: Number(item.quantity || 1),
                })),
        }),
      });
      const refreshed = await apiFetch(`/api/bundles/${uuid}`, {
        method: "GET",
      });
      setBundle(refreshed);
    } catch (err) {
      setFieldErrors(normalizeBundleErrors(err?.payload || {}));
      setError(err.message || "Failed to update bundle.");
    } finally {
      setSubmitting(false);
    }
  };

  const onUploadImage = async () => {
    if (!imageFile) return;
    setUploadingImage(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", imageFile);
      const refreshed = await apiFetch(`/api/bundles/${uuid}/image`, {
        method: "PUT",
        body: form,
      });
      setBundle(refreshed);
      setImageFile(null);
    } catch (err) {
      setError(err.message || "Failed to upload bundle image.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading bundles...</div>;

  return (
    <div
      id="main-wrapper"
      className={`show${menuToggled ? " menu-toggle" : ""}`}
    >
      <NavHeader
        toggled={menuToggled}
        onToggle={() => setMenuToggled((prev) => !prev)}
      />
      <Sidebar />
      <Topbar name={fullName} role={role} />
      <div className="content-body" style={{ minHeight: "100vh" }}>
        <div className="container-fluid">
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Bundle Image</h5>
            </div>
            <div className="card-body">
              {bundle?.imageUrl ? (
                <img
                  src={getTransformedImageUrl(bundle.imageUrl)}
                  alt={bundle.titleEn || "Bundle"}
                  style={{
                    width: 120,
                    height: 120,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <p className="mb-2">No image uploaded.</p>
              )}
              <div
                className="d-flex align-items-center mt-3"
                style={{ gap: "8px" }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] || null)
                  }
                />
                <button
                  className="btn btn-outline-primary btn-sm"
                  type="button"
                  onClick={onUploadImage}
                  disabled={uploadingImage || !imageFile}
                >
                  {uploadingImage ? "Uploading..." : "Upload Image"}
                </button>
              </div>
            </div>
          </div>
          <BundleForm
            title="Edit Bundle"
            backHref={`/bundles/${uuid}`}
            submitLabel="Save Bundle"
            submitting={submitting}
            error={error}
            fieldErrors={fieldErrors}
            formData={formData}
            apiFetch={apiFetch}
            onChange={onChange}
            onSubmit={onSubmit}
            variantOptionsByProduct={variantOptionsByProduct}
            selectedProductsByUuid={selectedProductsByUuid}
            onLoadVariants={loadVariants}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
            onItemChange={onItemChange}
            onSelectItemProduct={onSelectItemProduct}
            categoryOptions={categoryOptions}
            categorySearch={categorySearch}
            setCategorySearch={setCategorySearch}
            selectedSourceCategories={selectedSourceCategories}
            onToggleSourceCategory={onToggleSourceCategory}
            selectedAnchorProduct={
              formData.anchorProductUuid
                ? selectedProductsByUuid[formData.anchorProductUuid] || null
                : null
            }
            onSelectAnchorProduct={onSelectAnchorProduct}
          />
        </div>
      </div>
      <Footer />
    </div>
  );
}
