"use client";

import Link from "next/link";
import ProductAjaxSearchSelect from "@/components/products/ProductAjaxSearchSelect";

const EMPTY_ITEM = {
  productUuid: "",
  variantUuid: "",
  quantity: "1",
};

export function createEmptyBundleItem() {
  return { ...EMPTY_ITEM };
}

function renderFieldError(errors, ...keys) {
  for (const key of keys) {
    const value = errors?.[key];
    if (value) return value;
  }
  return "";
}

function variantLabel(variant) {
  const title = variant?.titleEn || variant?.title || variant?.sku || "Variant";
  return variant?.sku ? `${title} (${variant.sku})` : title;
}

function flattenCategories(categories = [], depth = 0) {
  return categories.flatMap((category) => [
    { ...category, depth },
    ...flattenCategories(category?.children || [], depth + 1),
  ]);
}

function formatCategoryLabel(category) {
  const names = [category?.nameEn, category?.nameAr].filter(Boolean);
  return names.length > 1 ? `${names[0]} / ${names[1]}` : names[0] || "Category";
}

export function normalizeBundleErrors(payload) {
  const source = payload?.errors || {};
  const result = {
    "title.en": "",
    "title.ar": "",
    "brief.en": "",
    "brief.ar": "",
    slug: "",
    discountType: "",
    flatPriceValue: "",
    discountPercentage: "",
    discountAmountValue: "",
    amountCurrencyCode: "",
    mode: "",
    anchorProductUuid: "",
    sourceCategoryUuids: "",
    autoFillCount: "",
    startsAt: "",
    finishesAt: "",
    items: "",
    error: source?.error || payload?.message || payload?.error || "",
  };

  const collect = (prefix, value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      result[prefix] = value.join(", ");
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([childKey, childValue]) => {
        collect(`${prefix}.${childKey}`, childValue);
      });
      return;
    }
    result[prefix] = String(value);
  };

  if (source && typeof source === "object" && !Array.isArray(source)) {
    Object.entries(source).forEach(([key, value]) => {
      if (key === "error") return;
      collect(key, value);
    });
  }

  return result;
}

export default function BundleForm({
  title,
  backHref,
  submitLabel,
  submitting,
  error,
  fieldErrors,
  formData,
  apiFetch,
  onChange,
  onSubmit,
  variantOptionsByProduct,
  selectedProductsByUuid,
  onLoadVariants,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onSelectItemProduct,
  categoryOptions = [],
  categorySearch = "",
  setCategorySearch = () => {},
  selectedSourceCategories = [],
  onToggleSourceCategory = () => {},
  selectedAnchorProduct = null,
  onSelectAnchorProduct = () => {},
}) {
  const flatCategories = flattenCategories(categoryOptions);
  const filteredCategoryOptions = flatCategories.filter((category) =>
    formatCategoryLabel(category)
      .toLowerCase()
      .includes(String(categorySearch || "").toLowerCase()),
  );
  const isFixedMode = formData.mode === "fixed";
  const isHybridMode = formData.mode === "hybrid";
  const showManualItems = isFixedMode || isHybridMode;
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="card-title mb-0">{title}</h4>
        <Link href={backHref} className="btn btn-outline-primary btn-sm">
          Back
        </Link>
      </div>
      <div className="card-body">
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Title (EN)</label>
              <input
                className={`form-control${renderFieldError(fieldErrors, "title.en") ? " is-invalid" : ""}`}
                name="titleEn"
                value={formData.titleEn}
                onChange={onChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Title (AR)</label>
              <input
                className={`form-control${renderFieldError(fieldErrors, "title.ar") ? " is-invalid" : ""}`}
                name="titleAr"
                value={formData.titleAr}
                onChange={onChange}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Brief (EN)</label>
              <textarea
                className="form-control"
                name="briefEn"
                rows={3}
                maxLength={256}
                value={formData.briefEn}
                onChange={onChange}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Brief (AR)</label>
              <textarea
                className="form-control"
                name="briefAr"
                rows={3}
                maxLength={256}
                value={formData.briefAr}
                onChange={onChange}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Slug</label>
              <input
                className={`form-control${renderFieldError(fieldErrors, "slug") ? " is-invalid" : ""}`}
                name="slug"
                value={formData.slug}
                onChange={onChange}
                required
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Discount Type</label>
              <select
                className="form-control"
                name="discountType"
                value={formData.discountType}
                onChange={onChange}
              >
                <option value="percentage_off">Percentage Off</option>
                <option value="fixed_amount_off">Fixed Amount Off</option>
                <option value="flat_total">Flat Bundle Total</option>
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Amount Currency</label>
              <select
                className="form-control"
                name="amountCurrencyCode"
                value={formData.amountCurrencyCode}
                onChange={onChange}
              >
                {["qar", "aed", "sar", "usd", "bhd", "kwd", "omr"].map(
                  (code) => (
                    <option key={code} value={code}>
                      {code.toUpperCase()}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Bundle Mode</label>
              <select
                className="form-control"
                name="mode"
                value={formData.mode}
                onChange={onChange}
              >
                <option value="fixed">Fixed (Manual)</option>
                <option value="hybrid">Hybrid</option>
                <option value="auto">Auto</option>
              </select>
            </div>

            {formData.discountType === "percentage_off" ? (
              <div className="col-md-4 mb-3">
                <label className="form-label">Discount Percentage</label>
                <input
                  className="form-control"
                  name="discountPercentage"
                  type="number"
                  min="1"
                  max="99"
                  step="0.01"
                  value={formData.discountPercentage}
                  onChange={onChange}
                  required
                />
              </div>
            ) : null}

            {formData.discountType === "fixed_amount_off" ? (
              <div className="col-md-4 mb-3">
                <label className="form-label">Discount Amount</label>
                <input
                  className="form-control"
                  name="discountAmountValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountAmountValue}
                  onChange={onChange}
                  required
                />
              </div>
            ) : null}

            {formData.discountType === "flat_total" ? (
              <div className="col-md-4 mb-3">
                <label className="form-label">Flat Bundle Total</label>
                <input
                  className="form-control"
                  name="flatPriceValue"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.flatPriceValue}
                  onChange={onChange}
                  required
                />
              </div>
            ) : null}

            {!isFixedMode ? (
              <>
                <div className="col-md-6 mb-3">
                  <ProductAjaxSearchSelect
                    apiFetch={apiFetch}
                    label="Anchor Product"
                    selectedProductUuid={formData.anchorProductUuid}
                    selectedProduct={selectedAnchorProduct}
                    onSelectProduct={onSelectAnchorProduct}
                  />
                  {renderFieldError(fieldErrors, "anchorProductUuid") ? (
                    <div className="text-danger small mt-1">
                      {renderFieldError(fieldErrors, "anchorProductUuid")}
                    </div>
                  ) : null}
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Auto Fill Count</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, "autoFillCount") ? " is-invalid" : ""}`}
                    name="autoFillCount"
                    type="number"
                    min="1"
                    value={formData.autoFillCount}
                    onChange={onChange}
                  />
                </div>
                <div className="col-md-3 mb-3 d-flex align-items-end">
                  <div className="alert alert-light border w-100 mb-0 py-2">
                    {isHybridMode
                      ? "Manual items stay first, then the backend auto-fills the remaining products."
                      : "All bundle items are resolved automatically from the anchor product and source categories."}
                  </div>
                </div>
              </>
            ) : null}

            <div className="col-md-4 mb-3">
              <label className="form-label">Starts At</label>
              <input
                className="form-control"
                name="startsAt"
                type="datetime-local"
                value={formData.startsAt}
                onChange={onChange}
                required
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Finishes At</label>
              <input
                className="form-control"
                name="finishesAt"
                type="datetime-local"
                value={formData.finishesAt}
                onChange={onChange}
                required
              />
            </div>
            <div className="col-md-4 mb-3 d-flex align-items-end">
              <div className="form-check">
                <input
                  className="form-check-input"
                  id="bundle-active"
                  name="isActive"
                  type="checkbox"
                  checked={Boolean(formData.isActive)}
                  onChange={onChange}
                />
                <label className="form-check-label" htmlFor="bundle-active">
                  Active Bundle
                </label>
              </div>
            </div>
          </div>

          {!isFixedMode ? (
            <div className="row mt-3">
              <div className="col-lg-4 mb-3">
                <div
                  className="card bg-light border-0"
                  style={{ borderRadius: "20px" }}
                >
                  <div className="card-body" style={{ padding: "24px" }}>
                    <h5 className="card-title">Selected Source Categories</h5>
                    {selectedSourceCategories.length > 0 ? (
                      <div
                        className="d-flex flex-column"
                        style={{ gap: "10px", maxHeight: "240px", overflowY: "auto" }}
                      >
                        {flatCategories
                          .filter((category) =>
                            selectedSourceCategories.includes(category.uuid),
                          )
                          .map((category) => (
                            <span
                              key={category.uuid}
                              className="badge badge-primary"
                              style={{
                                display: "inline-flex",
                                width: "fit-content",
                                maxWidth: "100%",
                                whiteSpace: "normal",
                                textAlign: "left",
                                lineHeight: 1.35,
                                padding: "10px 16px",
                                borderRadius: "999px",
                                fontSize: "13px",
                                fontWeight: 600,
                              }}
                            >
                              {formatCategoryLabel(category)}
                            </span>
                          ))}
                      </div>
                    ) : (
                      <div
                        className="border bg-white"
                        style={{
                          borderRadius: "16px",
                          padding: "16px 18px",
                        }}
                      >
                        <p className="mb-0 text-muted small" style={{ lineHeight: 1.6 }}>
                          No source categories selected. The backend will use the
                          anchor product categories.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-lg-8 mb-3">
                <label className="form-label">Source Category Search</label>
                <input
                  className="form-control mb-3"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Search categories..."
                />
                <div
                  className="border rounded p-3 bg-white"
                  style={{ maxHeight: "280px", overflowY: "auto" }}
                >
                  {filteredCategoryOptions.length === 0 ? (
                    <p className="mb-0 text-muted">No categories found.</p>
                  ) : (
                    filteredCategoryOptions.map((category) => {
                      const checked = selectedSourceCategories.includes(
                        category.uuid,
                      );
                      return (
                        <label
                          key={category.uuid}
                          className="d-flex align-items-center"
                          style={{
                            marginBottom: "10px",
                            padding: `8px 12px 8px ${12 + Number(category.depth || 0) * 18}px`,
                            borderRadius: "12px",
                            background: checked
                              ? "rgba(13, 110, 253, 0.08)"
                              : "transparent",
                            cursor: "pointer",
                            width: "100%",
                            maxWidth: "100%",
                            overflow: "hidden",
                            boxSizing: "border-box",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="me-2"
                            checked={checked}
                            onChange={() => onToggleSourceCategory(category.uuid)}
                            style={{
                              flex: "0 0 auto",
                              marginLeft: 0,
                              marginTop: 0,
                              width: "18px",
                              height: "18px",
                            }}
                          />
                          <span
                            style={{
                              minWidth: 0,
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              lineHeight: 1.45,
                            }}
                          >
                            {formatCategoryLabel(category)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                {renderFieldError(fieldErrors, "sourceCategoryUuids") ? (
                  <div className="text-danger small mt-2">
                    {renderFieldError(fieldErrors, "sourceCategoryUuids")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {showManualItems ? (
            <>
              <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
                <h5 className="mb-0">
                  {isHybridMode ? "Manual Bundle Items" : "Bundle Items"}
                </h5>
                <button
                  className="btn btn-outline-primary btn-sm"
                  type="button"
                  onClick={onAddItem}
                >
                  Add Item
                </button>
              </div>
              {renderFieldError(fieldErrors, "items") ? (
                <div className="alert alert-danger py-2">
                  {renderFieldError(fieldErrors, "items")}
                </div>
              ) : null}

              {formData.items.map((item, index) => {
                const variants = variantOptionsByProduct[item.productUuid] || [];
                return (
                  <div
                    key={`bundle-item-${index}`}
                    className="border rounded p-3 mb-3"
                  >
                    <div className="row">
                      <div className="col-md-5 mb-3">
                        <ProductAjaxSearchSelect
                          apiFetch={apiFetch}
                          label="Product"
                          selectedProductUuid={item.productUuid}
                          selectedProduct={
                            item.productUuid
                              ? selectedProductsByUuid?.[item.productUuid] || null
                              : null
                          }
                          onSelectProduct={(product) =>
                            onSelectItemProduct(index, product)
                          }
                        />
                      </div>
                      <div className="col-md-4 mb-3">
                        <label className="form-label">Variant (Optional)</label>
                        <select
                          className="form-control"
                          value={item.variantUuid}
                          onChange={(event) =>
                            onItemChange(index, "variantUuid", event.target.value)
                          }
                          disabled={!item.productUuid}
                        >
                          <option value="">Any variant of product</option>
                          {variants.map((variant) => (
                            <option key={variant.uuid} value={variant.uuid}>
                              {variantLabel(variant)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-2 mb-3">
                        <label className="form-label">Quantity</label>
                        <input
                          className="form-control"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            onItemChange(index, "quantity", event.target.value)
                          }
                        />
                      </div>
                      <div className="col-md-1 mb-3 d-flex align-items-end">
                        <button
                          className="btn btn-outline-danger btn-sm w-100"
                          type="button"
                          onClick={() => onRemoveItem(index)}
                          disabled={
                            formData.items.length <= (isHybridMode ? 1 : 2)
                          }
                        >
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="alert alert-light border mt-3 mb-0">
              Auto bundles do not store manual items. Products will be resolved
              dynamically from the anchor product and selected source categories.
            </div>
          )}

          <div className="mt-3">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
