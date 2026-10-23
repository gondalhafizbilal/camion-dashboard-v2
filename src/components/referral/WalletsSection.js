'use client';

import ReferralPagination from '@/components/referral/ReferralPagination';

function toCurrency(value, code) {
  const amount = Number(value || 0);
  return `${code || 'USD'} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

export default function WalletsSection({
  loading,
  search,
  setSearch,
  itemsPerPage,
  setItemsPerPage,
  onRefresh,
  wallets,
  pageNumber,
  setPageNumber,
}) {
  return (
    <>
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
              <th>Wallet UUID</th>
              <th>Affiliate UUID</th>
              <th>Amount</th>
              <th>Pending</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((item) => (
              <tr key={item.uuid}>
                <td>{item.uuid || '-'}</td>
                <td>{item.affiliate?.uuid || '-'}</td>
                <td>{toCurrency(item.amount?.amount, item.amount?.currencyCode)}</td>
                <td>{toCurrency(item.amountPending?.amount, item.amountPending?.currencyCode)}</td>
                <td>{toCurrency(item.amountAvailable?.amount, item.amountAvailable?.currencyCode)}</td>
              </tr>
            ))}
            {!loading && wallets.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-muted">No wallets found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ReferralPagination pageNumber={pageNumber} setPageNumber={setPageNumber} loading={loading} />
    </>
  );
}
