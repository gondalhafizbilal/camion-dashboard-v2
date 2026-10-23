'use client';

import { formatDateTime } from '@/lib/dateTime';

function formatCategoryLabel(category) {
  if (!category) return '-';
  const name = category?.nameEn || category?.slug || '-';
  return `${name} (${category?.uuid || '-'})`;
}

export default function ExportRequestForm({
  mode,
  formData,
  setFormData,
  errors = {},
  categories = [],
  categoryLoading = false,
  saving = false,
  onSubmit,
  onCancel,
  request = null,
}) {
  const isCreate = mode === 'create';
  const showCategory = isCreate && String(formData.format || '').startsWith('products-');

  return (
    <form onSubmit={onSubmit}>
      {errors.error || errors.type ? <div className="alert alert-danger">{errors.error || errors.type}</div> : null}

      <div className="row">
        <div className="col-md-6 mb-3">
          <label className="form-label">Name</label>
          <input
            className="form-control"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Export Customers"
            required
          />
          {errors.name ? <small className="text-danger d-block mt-1">{errors.name}</small> : null}
        </div>

        {isCreate ? (
          <>
            <div className="col-md-6 mb-3">
              <label className="form-label">Format</label>
              <select
                className="form-control"
                value={formData.format}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    format: e.target.value,
                    categoryUUID: e.target.value.startsWith('products-') ? prev.categoryUUID : '',
                  }))
                }
                required
              >
                <option value="">Select format</option>
                <option value="products-json">Products JSON</option>
                <option value="products-csv">Products CSV</option>
                <option value="customers-json">Customers JSON</option>
                <option value="customers-csv">Customers CSV</option>
              </select>
              {errors.format ? <small className="text-danger d-block mt-1">{errors.format}</small> : null}
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">Pages Count</label>
              <input
                className="form-control"
                type="number"
                min="1"
                value={formData.pagesCount}
                onChange={(e) => setFormData((prev) => ({ ...prev, pagesCount: e.target.value }))}
                placeholder="20"
                required
              />
              {errors.pagesCount ? <small className="text-danger d-block mt-1">{errors.pagesCount}</small> : null}
            </div>

            {showCategory ? (
              <div className="col-md-6 mb-3">
                <label className="form-label">Category (Optional)</label>
                <select
                  className="form-control"
                  value={formData.categoryUUID}
                  onChange={(e) => setFormData((prev) => ({ ...prev, categoryUUID: e.target.value }))}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.uuid} value={category.uuid}>
                      {formatCategoryLabel(category)}
                    </option>
                  ))}
                </select>
                <small className="text-muted d-block mt-1">
                  {categoryLoading ? 'Loading categories...' : 'Optional for product exports.'}
                </small>
                {errors.categoryUUID ? <small className="text-danger d-block mt-1">{errors.categoryUUID}</small> : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {!isCreate ? (
        <div className="row">
          <div className="col-md-6 mb-3">
            <label className="form-label">Format</label>
            <input className="form-control" value={request?.format || '-'} disabled />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Pages Count</label>
            <input className="form-control" value={request?.pagesCount ?? '-'} disabled />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Category</label>
            <input className="form-control" value={formatCategoryLabel(request?.category)} disabled />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Status</label>
            <input className="form-control" value={request?.status || '-'} disabled />
          </div>
          <div className="col-md-12 mb-3">
            <label className="form-label">Download URL</label>
            <input className="form-control" value={request?.downloadUrl || '-'} disabled />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Created At</label>
            <input className="form-control" value={formatDateTime(request?.createdAt)} disabled />
          </div>
          <div className="col-md-6 mb-3">
            <label className="form-label">Updated At</label>
            <input className="form-control" value={formatDateTime(request?.updatedAt)} disabled />
          </div>
        </div>
      ) : null}

      <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
        {onCancel ? (
          <button className="btn btn-light" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : isCreate ? 'Create Export Request' : 'Update Export Request'}
        </button>
      </div>
    </form>
  );
}
