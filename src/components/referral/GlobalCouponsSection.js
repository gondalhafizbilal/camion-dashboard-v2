'use client';

import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/dateTime';

function getDiscountDisplay(item) {
  const type = String(item?.discountType || '').toLowerCase();
  if (type === 'percentage') {
    return item?.discountPercentage ?? '-';
  }
  if (type === 'fixed') {
    return item?.discountValue ?? '-';
  }
  return item?.discountPercentage ?? item?.discountValue ?? '-';
}

export function normalizeErrors(payload) {
  const backendErrors = payload?.errors || {};
  const result = {
    code: backendErrors?.code || '',
    discountType: backendErrors?.discountType || '',
    discountPercentage: backendErrors?.discountPercentage || '',
    discountValue: backendErrors?.discountValue || '',
    usageLimit: backendErrors?.usageLimit || '',
    expiresAt: backendErrors?.expiresAt || '',
    error: backendErrors?.error || payload?.message || '',
  };

  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value || ''])
  );
}

export default function GlobalCouponsSection({
  loading,
  search,
  setSearch,
  onRefresh,
  coupons,
  onDeleteCoupon,
}) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: '8px' }}>
        <h4 className="mb-0">Global Coupons Management</h4>
        <Link href="/referral/global-coupons/new" className="btn btn-primary btn-sm">
          Create Global Coupon
        </Link>
      </div>

      <div className="row mb-3">
        <div className="col-md-6 mb-2">
          <label className="form-label">Search</label>
          <input
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Code, discount, dates..."
          />
        </div>
        <div className="col-md-6 mb-2 d-flex align-items-end">
          <button className="btn btn-primary btn-block" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Loading...' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Discount</th>
              <th>Usage Limit</th>
              <th>Orders</th>
              <th>Times Used</th>
              <th>Total Sales</th>
              <th>Total Commission</th>
              <th>Expires</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((item) => (
              <tr key={item.uuid}>
                <td>{item.code || '-'}</td>
                <td>{item.discountType || '-'}</td>
                <td>
                  {getDiscountDisplay(item)}
                  {String(item?.discountType || '').toLowerCase() === 'percentage' ? '%' : ''}
                </td>
                <td>{item.usageLimit ?? '-'}</td>
                <td>{item.ordersCount ?? '-'}</td>
                <td>{item.timesUsed ?? '-'}</td>
                <td>{item.totalSales ? `${item.totalSales.currencyCode || ''} ${item.totalSales.amount ?? 0}`.trim() : '-'}</td>
                <td>
                  {item.totalCommission
                    ? `${item.totalCommission.currencyCode || ''} ${item.totalCommission.amount ?? 0}`.trim()
                    : '-'}
                </td>
                <td>{formatDate(item.expiresAt)}</td>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>{formatDateTime(item.updatedAt)}</td>
                <td>
                  <div className="d-flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
                    <Link className="btn btn-info btn-xs" href={`/referral/global-coupons/${item.uuid}/edit`}>
                      View
                    </Link>
                    <Link className="btn btn-outline-primary btn-xs" href={`/referral/global-coupons/${item.uuid}/edit`}>
                      Edit
                    </Link>
                    <button className="btn btn-outline-dark btn-xs" type="button" onClick={() => onDeleteCoupon(item.uuid)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && coupons.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center text-muted">
                  No global coupons found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
