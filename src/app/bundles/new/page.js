"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewBundlePage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [variantOptionsByProduct, setVariantOptionsByProduct] = useState({});
  const [selectedProductsByUuid, setSelectedProductsByUuid] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [selectedSourceCategories, setSelectedSourceCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
    startsAt: toLocalDateTimeValue(new Date()),
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
      if (options.body !== undefined && !headers.has("Content-Type"))
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
        } else if (prev.items.length === 0) {
          next.items = [createEmptyBundleItem()];
        } else if (value === "auto") {
          next.items = [];
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
        setSelectedProductsByUuid((prev) => ({
          ...prev,
          [product.uuid]: product,
        }));
        loadVariants(product.uuid);
      }
    },
    [loadVariants],
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

  const onSelectAnchorProduct = useCallback((product) => {
    const nextProductUuid = product?.uuid || "";
    setFormData((prev) => ({
      ...prev,
      anchorProductUuid: nextProductUuid,
    }));
    if (product?.uuid) {
      setSelectedProductsByUuid((prev) => ({
        ...prev,
        [product.uuid]: product,
      }));
    }
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const payload = {
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
      };

      const created = await apiFetch("/api/bundles", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.replace(`/bundles/${created.uuid}/edit`);
    } catch (err) {
      setFieldErrors(normalizeBundleErrors(err?.payload || {}));
      setError(err.message || "Failed to create bundle.");
    } finally {
      setSubmitting(false);
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
          <BundleForm
            title="Create Bundle"
            backHref="/bundles"
            submitLabel="Create Bundle"
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
