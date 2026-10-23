'use client';

import ReferralPagination from '@/components/referral/ReferralPagination';
import { formatDate } from '@/lib/dateTime';

export default function CouponsSection({
  loading,
  createLoading,
  affiliates,
  affiliatesLoading,
  showCreateForm,
  setShowCreateForm,
  createForm,
  setCreateForm,
  createFieldErrors,
  onCreateCoupon,
  search,
  setSearch,
  itemsPerPage,
  setItemsPerPage,
  onRefresh,
  coupons,
  onDeleteCoupon,
  pageNumber,
  setPageNumber,
}) {
  const renderAffiliateLabel = (item) => {
    const fullName = item?.affiliate?.customer?.fullName || item?.affiliate?.fullName || 'Unknown';
    const emailAddress = item?.affiliate?.customer?.emailAddress || '';

    return (
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.3 }}>
          {fullName}
        </div>
        <div className="text-muted" style={{ fontSize: '12px', lineHeight: 1.2 }}>
          {emailAddress || 'N/A'}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-3 d-flex" style={{ gap: '8px' }}>
        <button
          className="btn btn-outline-primary btn-sm"
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          disabled={createLoading}
        >
          {showCreateForm ? 'Close Create Coupon' : 'Create Coupon'}
        </button>
      </div>

      {showCreateForm ? (
        <div className="card mb-3">
          <div className="card-body">
            <div className="row">
              <div className="col-md-6 mb-2">
                <label className="form-label">Affiliate</label>
                <select
                  className={`form-control ${createFieldErrors?.affiliateUuid ? 'is-invalid' : ''}`}
                  value={createForm.affiliateUuid}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, affiliateUuid: e.target.value }))}
                  disabled={createLoading || affiliatesLoading}
                >
                  <option value="">{affiliatesLoading ? 'Loading affiliates...' : 'Select affiliate'}</option>
                  {Array.isArray(affiliates)
                    ? affiliates.map((item) => (
                        <option key={item?.uuid} value={item?.uuid}>
                          {`${item?.fullName || item?.customer?.fullName || 'Unknown'} (${item?.uuid || '-'})`}
                        </option>
                      ))
                    : null}
                </select>
                {createFieldErrors?.affiliateUuid ? <div className="invalid-feedback">{createFieldErrors.affiliateUuid}</div> : null}
              </div>
              <div className="col-md-3 mb-2">
                <label className="form-label">Code</label>
                <input
                  className={`form-control ${createFieldErrors?.code ? 'is-invalid' : ''}`}
                  value={createForm.code}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="summer10"
                  disabled={createLoading}
                />
                {createFieldErrors?.code ? <div className="invalid-feedback">{createFieldErrors.code}</div> : null}
              </div>
              <div className="col-md-3 mb-2">
                <label className="form-label">Discount %</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={`form-control ${createFieldErrors?.discountPercentage ? 'is-invalid' : ''}`}
                  value={createForm.discountPercentage}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, discountPercentage: e.target.value }))}
                  placeholder="10"
                  disabled={createLoading}
                />
                {createFieldErrors?.discountPercentage ? <div className="invalid-feedback">{createFieldErrors.discountPercentage}</div> : null}
              </div>
              <div className="col-md-4 mb-2">
                <label className="form-label">Expires At</label>
                <input
                  type="date"
                  className={`form-control ${createFieldErrors?.expiresAt ? 'is-invalid' : ''}`}
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                  disabled={createLoading}
                />
                {createFieldErrors?.expiresAt ? <div className="invalid-feedback">{createFieldErrors.expiresAt}</div> : null}
              </div>
              <div className="col-md-12 mb-2 d-flex justify-content-end" style={{ gap: '8px' }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={onCreateCoupon} disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="row mb-3">
        <div className="col-md-6 mb-2">
          <label className="form-label">Search</label>
          <input
            className="form-control"
            value={search}
            onChange={(e) => {
              setPageNumber(1);
              setSearch(e.target.value);
            }}
            placeholder="Search"
          />
        </div>
        <div className="col-md-2 mb-2">
          <label className="form-label">Items/Page</label>
          <select className="form-control" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <button className="btn btn-primary btn-sm" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount %</th>
              <th>Orders</th>
              <th>Expires</th>
              <th>Affiliate</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((item) => (
              <tr key={item.uuid}>
                <td>{item.code || '-'}</td>
                <td>{item.discountPercentage ?? '-'}</td>
                <td>{item.ordersCount ?? '-'}</td>
                <td>{formatDate(item.expiresAt)}</td>
                <td>{renderAffiliateLabel(item)}</td>
                <td>
                  <button className="btn btn-outline-dark btn-xs" type="button" onClick={() => onDeleteCoupon(item.uuid)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && coupons.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-muted">
                  No coupons found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ReferralPagination pageNumber={pageNumber} setPageNumber={setPageNumber} loading={loading} />
    </>
  );
}
