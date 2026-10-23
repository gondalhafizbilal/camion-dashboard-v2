'use client';

import ReferralPagination from '@/components/referral/ReferralPagination';
import { formatDateTime } from '@/lib/dateTime';

function toCurrency(value, code) {
  const amount = Number(value || 0);
  return `${code || 'USD'} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

export default function TransactionsSection({
  loading,
  search,
  setSearch,
  wallets,
  selectedWalletUUID,
  setSelectedWalletUUID,
  transactionForm,
  setTransactionForm,
  onCreateTransaction,
  transactions,
  onReverseTransaction,
  itemsPerPage,
  setItemsPerPage,
  onRefresh,
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
        <div className="col-md-4 mb-2">
          <label className="form-label">Wallet</label>
          <select className="form-control" value={selectedWalletUUID} onChange={(e) => setSelectedWalletUUID(e.target.value)}>
            <option value="">Select wallet</option>
            {wallets.map((wallet) => (
              <option key={wallet.uuid} value={wallet.uuid}>{wallet.uuid}</option>
            ))}
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

      <div className="card mb-3">
        <div className="card-header"><h6 className="mb-0">Create Transaction</h6></div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-3 mb-2">
              <label className="form-label">Amount</label>
              <input className="form-control" type="number" value={transactionForm.amount} onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Currency</label>
              <input className="form-control" value={transactionForm.currencyCode} onChange={(e) => setTransactionForm((prev) => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))} />
            </div>
            <div className="col-md-2 mb-2">
              <label className="form-label">Type</label>
              <select className="form-control" value={transactionForm.type} onChange={(e) => setTransactionForm((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label">Description</label>
              <input className="form-control" value={transactionForm.description} onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))} />
            </div>
            <div className="col-md-2 mb-2 d-flex align-items-end">
              <button className="btn btn-primary w-100" type="button" onClick={onCreateTransaction}>Create</button>
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>UUID</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Description</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.uuid}>
                <td>{item.uuid || '-'}</td>
                <td>{toCurrency(item.amount?.amount, item.amount?.currencyCode)}</td>
                <td>{item.type || '-'}</td>
                <td>{item.description || '-'}</td>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>
                  <button className="btn btn-outline-danger btn-xs" type="button" onClick={() => onReverseTransaction(selectedWalletUUID, item.uuid)}>
                    Reverse
                  </button>
                </td>
              </tr>
            ))}
            {!loading && transactions.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted">No transactions found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ReferralPagination pageNumber={pageNumber} setPageNumber={setPageNumber} loading={loading} />
    </>
  );
}
