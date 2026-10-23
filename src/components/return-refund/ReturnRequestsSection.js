'use client';

import Link from 'next/link';
import { formatDateTime } from '@/lib/dateTime';

function amountView(money) {
  if (!money) return '-';
  return `${money.currencyCode || ''} ${money.amount ?? 0}`.trim();
}

function normalizeReason(reason) {
  const key = String(reason || '').toLowerCase();
  if (key === 'wrong_variation') return 'Wrong Variation';
  if (key === 'damaged_broken') return 'Damaged / Broken';
  if (key === 'wrong_product') return 'Wrong Product';
  return key || '-';
}

function normalizeStatus(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'pending') return 'Pending';
  if (key === 'approved') return 'Approved';
  if (key === 'rejected') return 'Rejected';
  if (key === 'refunded') return 'Refunded';
  return key || '-';
}

export default function ReturnRequestsSection({
  loading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  itemsPerPage,
  setItemsPerPage,
  pageNumber,
  setPageNumber,
  onRefresh,
  requests,
  onOpenStatusModal,
}) {
  const showCustomerColumn = requests.some(
    (item) => item?.customer?.fullName || item?.customer?.emailAddress || item?.customer?.phoneNumber
  );

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: '8px' }}>
        <h4 className="mb-0">Return & Refund Requests</h4>
        <button className="btn btn-outline-primary btn-sm" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="row mb-3">
        <div className="col-md-4 mb-2">
          <label className="form-label">Search</label>
          <input
            className="form-control"
            value={search}
            onChange={(e) => {
              setPageNumber(1);
              setSearch(e.target.value);
            }}
            placeholder="Customer, order, reason, note..."
          />
        </div>
        <div className="col-md-3 mb-2">
          <label className="form-label">Status</label>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => {
              setPageNumber(1);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div className="col-md-2 mb-2">
          <label className="form-label">Items/Page</label>
          <select className="form-control" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="col-md-3 mb-2 d-flex align-items-end">
          <button className="btn btn-primary btn-block" type="button" onClick={onRefresh} disabled={loading}>
            Apply
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              {showCustomerColumn ? <th>Customer</th> : null}
              <th>Order</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Refund</th>
              <th>Evidence</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((item) => (
              <tr key={item.uuid}>
                {showCustomerColumn ? (
                  <td>
                    <div>{item?.customer?.fullName || '-'}</div>
                    <small className="text-muted">{item?.customer?.emailAddress || item?.customer?.phoneNumber || ''}</small>
                  </td>
                ) : null}
                <td>
                  <div>{item?.order?.uuid || '-'}</div>
                  <small className="text-muted">{String(item?.order?.status || '-').toLowerCase()}</small>
                </td>
                <td>
                  <div>{normalizeReason(item.reason)}</div>
                  <small className="text-muted">{item.reasonDetail || '-'}</small>
                </td>
                <td>{normalizeStatus(item.status)}</td>
                <td>{amountView(item.refundAmount)}</td>
                <td>{Array.isArray(item.evidence) ? item.evidence.length : 0}</td>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>
                  <div className="d-flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-xs"
                      type="button"
                      onClick={() => onOpenStatusModal(item)}
                    >
                      Update Status
                    </button>
                    {item?.order?.uuid ? (
                      <Link href={`/orders/${item.order.uuid}`} className="btn btn-outline-info btn-xs">
                        View Order
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && requests.length === 0 ? (
              <tr>
                <td colSpan={showCustomerColumn ? 8 : 7} className="text-center text-muted">
                  No return requests found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
        <button className="btn btn-light btn-sm" type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber(pageNumber - 1)}>
          Previous
        </button>
        <button
          className="btn btn-light btn-sm"
          type="button"
          disabled={loading || requests.length < itemsPerPage}
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
