'use client';

import Link from 'next/link';

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

function formatCategoryLabel(category) {
  const parts = [category?.nameEn || category?.name || 'Unnamed'];
  if (category?.slug) parts.push(`(${category.slug})`);
  return parts.join(' ');
}

function formatSelectedCategoryLabel(category) {
  const name = category?.nameEn || category?.name || 'Unnamed';
  return category?.slug ? `${name} (${category.slug})` : name;
}

function renderFieldError(errors, ...keys) {
  for (const key of keys) {
    const value = errors?.[key];
    if (value) return value;
  }
  return '';
}

export function normalizeCampaignErrors(payload) {
  const source = payload?.errors || {};
  const result = {
    'name.en': '',
    'name.ar': '',
    'brief.en': '',
    'brief.ar': '',
    slug: '',
    pricingFactor: '',
    discountPercentage: '',
    urgencyEnabled: '',
    urgencyMinStockCount: '',
    urgencyMaxStockCount: '',
    startsAt: '',
    finishesAt: '',
    categories: '',
    error: source?.error || payload?.message || payload?.error || '',
  };

  const collect = (prefix, value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      const message = value.join(', ');
      if (message) result[prefix] = message;
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([childKey, childValue]) => {
        collect(`${prefix}.${childKey}`, childValue);
      });
      return;
    }
    result[prefix] = String(value);
  };

  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.entries(source).forEach(([key, value]) => {
      if (key === 'error') return;
      collect(key, value);
    });
  }

  return result;
}

export default function CampaignForm({
  title,
  backHref,
  submitLabel,
  submitting,
  error,
  fieldErrors,
  formData,
  onChange,
  onSubmit,
  categoryOptions,
  loadingCategories,
  categorySearch,
  setCategorySearch,
  selectedCategories,
  onToggleCategory,
  urgencyEnabled,
  urgencyMinStockCount,
  urgencyMaxStockCount,
  onToggleUrgency,
  onUrgencyChange,
}) {
  const filteredCategoryOptions = flattenCategories(categoryOptions).filter((category) => {
    const query = String(categorySearch || '').trim().toLowerCase();
    if (!query) return true;
    const name = String(category?.nameEn || category?.name || '').toLowerCase();
    const slug = String(category?.slug || '').toLowerCase();
    return name.includes(query) || slug.includes(query);
  });

  const selectedCategoryDetails = flattenCategories(categoryOptions).filter((category) => selectedCategories.includes(category.uuid));

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
            <div className="col-lg-8">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Name (EN)</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'name.en', 'nameEn') ? ' is-invalid' : ''}`}
                    name="nameEn"
                    value={formData.nameEn}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'name.en', 'nameEn') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'name.en', 'nameEn')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Name (AR)</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'name.ar', 'nameAr') ? ' is-invalid' : ''}`}
                    name="nameAr"
                    value={formData.nameAr}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'name.ar', 'nameAr') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'name.ar', 'nameAr')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Brief (EN)</label>
                  <textarea
                    className={`form-control${renderFieldError(fieldErrors, 'brief.en', 'briefEn') ? ' is-invalid' : ''}`}
                    name="briefEn"
                    value={formData.briefEn}
                    onChange={onChange}
                    rows={3}
                    maxLength={256}
                    required
                  />
                  {renderFieldError(fieldErrors, 'brief.en', 'briefEn') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'brief.en', 'briefEn')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Brief (AR)</label>
                  <textarea
                    className={`form-control${renderFieldError(fieldErrors, 'brief.ar', 'briefAr') ? ' is-invalid' : ''}`}
                    name="briefAr"
                    value={formData.briefAr}
                    onChange={onChange}
                    rows={3}
                    maxLength={256}
                    required
                  />
                  {renderFieldError(fieldErrors, 'brief.ar', 'briefAr') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'brief.ar', 'briefAr')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Slug</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'slug') ? ' is-invalid' : ''}`}
                    name="slug"
                    value={formData.slug}
                    onChange={onChange}
                    maxLength={64}
                    required
                  />
                  {renderFieldError(fieldErrors, 'slug') ? <span className="text-danger small">{renderFieldError(fieldErrors, 'slug')}</span> : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Pricing Factor</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'pricingFactor') ? ' is-invalid' : ''}`}
                    name="pricingFactor"
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.pricingFactor}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'pricingFactor') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'pricingFactor')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Discount Percentage</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'discountPercentage') ? ' is-invalid' : ''}`}
                    name="discountPercentage"
                    type="number"
                    min="1"
                    max="99"
                    value={formData.discountPercentage}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'discountPercentage') ? (
                    <span className="text-danger small">{renderFieldError(fieldErrors, 'discountPercentage')}</span>
                  ) : null}
                </div>
                <div className="col-md-6 mb-3 d-flex align-items-end">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="urgencyEnabled"
                      checked={Boolean(urgencyEnabled)}
                      onChange={(event) => onToggleUrgency(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="urgencyEnabled">
                      Enable Urgency
                    </label>
                  </div>
                </div>
                {urgencyEnabled ? (
                  <>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Urgency Minimum Stock</label>
                      <input
                        className={`form-control${renderFieldError(fieldErrors, 'urgencyMinStockCount', 'minStockCount') ? ' is-invalid' : ''}`}
                        name="urgencyMinStockCount"
                        type="number"
                        min="0"
                        step="1"
                        value={urgencyMinStockCount}
                        onChange={onUrgencyChange}
                      />
                      {renderFieldError(fieldErrors, 'urgencyMinStockCount', 'minStockCount') ? (
                        <span className="text-danger small">{renderFieldError(fieldErrors, 'urgencyMinStockCount', 'minStockCount')}</span>
                      ) : null}
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Urgency Maximum Stock</label>
                      <input
                        className={`form-control${renderFieldError(fieldErrors, 'urgencyMaxStockCount', 'maxStockCount') ? ' is-invalid' : ''}`}
                        name="urgencyMaxStockCount"
                        type="number"
                        min="0"
                        step="1"
                        value={urgencyMaxStockCount}
                        onChange={onUrgencyChange}
                      />
                      {renderFieldError(fieldErrors, 'urgencyMaxStockCount', 'maxStockCount') ? (
                        <span className="text-danger small">{renderFieldError(fieldErrors, 'urgencyMaxStockCount', 'maxStockCount')}</span>
                      ) : null}
                    </div>
                  </>
                ) : null}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Starts At</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'startsAt') ? ' is-invalid' : ''}`}
                    name="startsAt"
                    type="date"
                    value={formData.startsAt}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'startsAt') ? <span className="text-danger small">{renderFieldError(fieldErrors, 'startsAt')}</span> : null}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Finishes At</label>
                  <input
                    className={`form-control${renderFieldError(fieldErrors, 'finishesAt') ? ' is-invalid' : ''}`}
                    name="finishesAt"
                    type="date"
                    value={formData.finishesAt}
                    onChange={onChange}
                    required
                  />
                  {renderFieldError(fieldErrors, 'finishesAt') ? <span className="text-danger small">{renderFieldError(fieldErrors, 'finishesAt')}</span> : null}
                </div>
                <div className="col-md-6 mb-3 d-flex align-items-end">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="isFeatured" name="isFeatured" checked={formData.isFeatured} onChange={onChange} />
                    <label className="form-check-label" htmlFor="isFeatured">
                      Featured on Homepage
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="card bg-light border-0 mb-3" style={{ borderRadius: '24px' }}>
                <div className="card-body" style={{ padding: '28px' }}>
                  <h5 className="card-title">Selected Categories</h5>
                  {selectedCategoryDetails.length > 0 ? (
                    <div className="d-flex flex-column" style={{ gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                      {selectedCategoryDetails.map((category) => (
                        <span
                          key={category.uuid}
                          className="badge badge-primary"
                          style={{
                            display: 'inline-flex',
                            width: 'fit-content',
                            maxWidth: '100%',
                            whiteSpace: 'normal',
                            textAlign: 'left',
                            lineHeight: 1.35,
                            padding: '12px 18px',
                            borderRadius: '999px',
                            fontSize: '13px',
                            fontWeight: 600,
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatSelectedCategoryLabel(category)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mb-0 text-muted small">No categories selected.</p>
                  )}
                  {renderFieldError(fieldErrors, 'categories') ? (
                    <div className="text-danger small mt-2">{renderFieldError(fieldErrors, 'categories')}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 mb-3">
            <label className="form-label">Category Search</label>
            <input
              className="form-control"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories..."
              style={{ borderRadius: '14px' }}
            />
          </div>

          <div className="mb-3">
            <div className="border rounded p-3 bg-white" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {loadingCategories ? (
                <p className="mb-0">Loading categories...</p>
              ) : filteredCategoryOptions.length === 0 ? (
                <p className="mb-0 text-muted">No categories found.</p>
              ) : (
                filteredCategoryOptions.map((category) => {
                  const checked = selectedCategories.includes(category.uuid);
                  return (
                    <label
                      key={category.uuid}
                      className="d-flex align-items-center"
                      style={{
                        marginLeft: `${Number(category.depth || 0) * 18}px`,
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: checked ? 'rgba(203, 37, 46, 0.06)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={checked}
                        onChange={(event) => onToggleCategory(category.uuid, event.target.checked)}
                      />
                      <span style={{ fontSize: '14px', lineHeight: 1.35, wordBreak: 'break-word' }}>{formatCategoryLabel(category)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
