'use client';

import Link from 'next/link';

export default function GlobalCouponForm({
  title,
  loading,
  submitting,
  error,
  success,
  formData,
  setFormData,
  fieldErrors,
  onSubmit,
  onDelete,
  backHref,
  mode = 'create',
  extraDetails = null,
}) {
  const discountType = String(formData.discountType || '').toLowerCase();
  const isPercentage = discountType === 'percentage';
  const isFixed = discountType === 'fixed';

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="card-title mb-0">{title}</h4>
        <Link className="btn btn-outline-primary btn-sm" href={backHref}>
          Back to Global Coupons
        </Link>
      </div>
      <div className="card-body">
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}
        {loading ? <p className="mb-0">Loading global coupon...</p> : null}

        {!loading ? (
          <>
            {extraDetails}
            <form onSubmit={onSubmit}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Code</label>
                  <input
                    className={`form-control ${fieldErrors.code ? 'is-invalid' : ''}`}
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                    disabled={submitting}
                  />
                  {fieldErrors.code ? <div className="invalid-feedback">{fieldErrors.code}</div> : null}
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Discount Type</label>
                  <select
                    className={`form-control ${fieldErrors.discountType ? 'is-invalid' : ''}`}
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountType: e.target.value,
                        discountPercentage: e.target.value === 'percentage' ? prev.discountPercentage : '1',
                        discountValue: e.target.value === 'fixed' ? prev.discountValue : '1',
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">Select type</option>
                    <option value="percentage">percentage</option>
                    <option value="fixed">fixed</option>
                  </select>
                  {fieldErrors.discountType ? <div className="invalid-feedback">{fieldErrors.discountType}</div> : null}
                </div>
                {isPercentage ? (
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Discount %</label>
                    <input
                      type="number"
                      min={1}
                      step="0.01"
                      className={`form-control ${fieldErrors.discountPercentage ? 'is-invalid' : ''}`}
                      value={formData.discountPercentage}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountPercentage: e.target.value }))}
                      disabled={submitting}
                      required
                    />
                    {fieldErrors.discountPercentage ? <div className="invalid-feedback">{fieldErrors.discountPercentage}</div> : null}
                  </div>
                ) : null}
                {isFixed ? (
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Discount Value</label>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      className={`form-control ${fieldErrors.discountValue ? 'is-invalid' : ''}`}
                      value={formData.discountValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
                      disabled={submitting}
                      required
                    />
                    {fieldErrors.discountValue ? <div className="invalid-feedback">{fieldErrors.discountValue}</div> : null}
                  </div>
                ) : null}
                {!isPercentage && !isFixed ? (
                  <>
                    <input type="hidden" value="1" name="discountPercentage" />
                    <input type="hidden" value="1" name="discountValue" />
                  </>
                ) : null}
                <div className="col-md-4 mb-3">
                  <label className="form-label">Usage Limit</label>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    className={`form-control ${fieldErrors.usageLimit ? 'is-invalid' : ''}`}
                    value={formData.usageLimit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
                    disabled={submitting}
                  />
                  {fieldErrors.usageLimit ? <div className="invalid-feedback">{fieldErrors.usageLimit}</div> : null}
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Expires At</label>
                  <input
                    type="date"
                    className={`form-control ${fieldErrors.expiresAt ? 'is-invalid' : ''}`}
                    value={formData.expiresAt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    disabled={submitting}
                  />
                  {fieldErrors.expiresAt ? <div className="invalid-feedback">{fieldErrors.expiresAt}</div> : null}
                </div>
              </div>

              <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                <button className="btn btn-primary btn-sm" type="submit" disabled={submitting}>
                  {submitting ? (mode === 'create' ? 'Creating...' : 'Saving...') : mode === 'create' ? 'Create Global Coupon' : 'Save Changes'}
                </button>
                {mode === 'edit' ? (
                  <button className="btn btn-danger btn-sm" type="button" onClick={onDelete} disabled={submitting}>
                    Delete
                  </button>
                ) : null}
              </div>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
