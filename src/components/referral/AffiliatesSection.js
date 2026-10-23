'use client';

import Link from 'next/link';
import ReferralPagination from '@/components/referral/ReferralPagination';

function normalizeStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function formatMoney(value, currencyCode) {
  const amount = Number(value || 0);
  return `${currencyCode || 'USD'} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

export default function AffiliatesSection({
  loading,
  search,
  setSearch,
  affiliateTypeFilter,
  setAffiliateTypeFilter,
  affiliateStatusFilter,
  setAffiliateStatusFilter,
  itemsPerPage,
  setItemsPerPage,
  onRefresh,
  affiliates,
  onUpdateAffiliateStatus,
  onUpdateAffiliateType,
  onDeleteAffiliate,
  pageNumber,
  setPageNumber,
}) {
  return (
    <>
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
            placeholder="Search"
          />
        </div>
        <div className="col-md-3 mb-2">
          <label className="form-label">Type</label>
          <select className="form-control" value={affiliateTypeFilter} onChange={(e) => setAffiliateTypeFilter(e.target.value)}>
            <option value="">All</option>
            <option value="affiliate">Affiliate</option>
            <option value="influencer">Influencer</option>
          </select>
        </div>
        <div className="col-md-3 mb-2">
          <label className="form-label">Status</label>
          <select className="form-control" value={affiliateStatusFilter} onChange={(e) => setAffiliateStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
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
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Coupons Created</th>
              <th>Coupons Used</th>
              <th>Wallet Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((item) => (
              <tr key={item.uuid}>
                <td>{item.fullName || '-'}</td>
                <td>{item.type || '-'}</td>
                <td>{item.status || '-'}</td>
                <td>{item.couponsCreated ?? '-'}</td>
                <td>{item.couponsUsed ?? '-'}</td>
                <td>{item.wallet ? formatMoney(item.wallet.amount?.amount, item.wallet.amount?.currencyCode) : '-'}</td>
                <td>
                  <div className="d-flex" style={{ gap: '6px', flexWrap: 'wrap' }}>
                    <Link className="btn btn-outline-primary btn-xs" href={`/referral/affiliates/${item.uuid}`}>
                      View
                    </Link>
                    <Link className="btn btn-outline-info btn-xs" href={`/referral/coupons?affiliateUuid=${encodeURIComponent(item.uuid)}`}>
                      Coupons
                    </Link>
                    <Link
                      className={`btn btn-outline-secondary btn-xs${item.wallet?.uuid ? '' : ' disabled'}`}
                      href={item.wallet?.uuid ? `/referral/transactions?walletUUID=${encodeURIComponent(item.wallet.uuid)}` : '#'}
                      aria-disabled={!item.wallet?.uuid}
                      tabIndex={item.wallet?.uuid ? 0 : -1}
                    >
                      Transactions
                    </Link>
                    {(() => {
                      const status = normalizeStatus(item.status);
                      if (status === 'accepted') {
                        return (
                          <button
                            className="btn btn-outline-danger btn-xs"
                            onClick={() => onUpdateAffiliateStatus(item.uuid, 'rejected')}
                            type="button"
                          >
                            Reject
                          </button>
                        );
                      }
                      if (status === 'rejected') {
                        return (
                          <button
                            className="btn btn-outline-success btn-xs"
                            onClick={() => onUpdateAffiliateStatus(item.uuid, 'accepted')}
                            type="button"
                          >
                            Accept
                          </button>
                        );
                      }
                      return (
                        <>
                          <button
                            className="btn btn-outline-success btn-xs"
                            onClick={() => onUpdateAffiliateStatus(item.uuid, 'accepted')}
                            type="button"
                          >
                            Accept
                          </button>
                          <button
                            className="btn btn-outline-danger btn-xs"
                            onClick={() => onUpdateAffiliateStatus(item.uuid, 'rejected')}
                            type="button"
                          >
                            Reject
                          </button>
                        </>
                      );
                    })()}
                    <button className="btn btn-outline-info btn-xs" onClick={() => onUpdateAffiliateType(item.uuid, item.type === 'affiliate' ? 'influencer' : 'affiliate')} type="button">Toggle Type</button>
                    <button className="btn btn-outline-dark btn-xs" onClick={() => onDeleteAffiliate(item.uuid)} type="button">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && affiliates.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-muted">No affiliates found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ReferralPagination pageNumber={pageNumber} setPageNumber={setPageNumber} loading={loading} />
    </>
  );
}
