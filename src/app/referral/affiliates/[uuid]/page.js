'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import { formatDateTime } from '@/lib/dateTime';

function formatMoney(money) {
  const amount = Number(money?.amount || 0);
  return `${money?.currencyCode || 'USD'} ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function getAffiliateCouponsQuery(affiliateUUID) {
  const params = new URLSearchParams();
  params.set('filters', JSON.stringify({ affiliateUUID }));
  params.set('pageNumber', '1');
  params.set('itemsPerPage', '100');
  return params.toString();
}

function getTransactionsQuery() {
  const params = new URLSearchParams();
  params.set('pageNumber', '1');
  params.set('itemsPerPage', '50');
  return params.toString();
}

export default function AffiliateDetailPage() {
  const { isValid, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const params = useParams();
  const uuid = params?.uuid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [affiliate, setAffiliate] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const loadData = useCallback(async () => {
    if (!isValid || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const affiliateData = await apiFetch(`/api/referral/affiliates/${uuid}`, { method: 'GET' });
      setAffiliate(affiliateData || null);

      const affiliateUUID = String(affiliateData?.uuid || uuid);
      const [couponData, transactionData] = await Promise.all([
        apiFetch(`/api/referral/coupons?${getAffiliateCouponsQuery(affiliateUUID)}`, { method: 'GET' }).catch(() => []),
        affiliateData?.wallet?.uuid
          ? apiFetch(
              `/api/referral/wallets/${encodeURIComponent(String(affiliateData.wallet.uuid))}/transactions?${getTransactionsQuery()}`,
              { method: 'GET' }
            ).catch(() => [])
          : Promise.resolve([]),
      ]);

      setCoupons(Array.isArray(couponData) ? couponData : []);
      setTransactions(Array.isArray(transactionData) ? transactionData : []);
    } catch (err) {
      setError(err.message || 'Failed to load affiliate.');
      setAffiliate(null);
      setCoupons([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isValid, uuid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isValid) return <div className="screen-center">Loading affiliate...</div>;

  const wallet = affiliate?.wallet || null;
  const customer = affiliate?.customer || null;

  return (
    <ReferralPageFrame
      title="Referral - Affiliate Details"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success=""
    >
      <div className="d-flex flex-wrap mb-3" style={{ gap: '8px' }}>
        <Link href="/referral/affiliates" className="btn btn-outline-primary btn-sm">
          Back to Affiliates
        </Link>
        <Link href={affiliate?.uuid ? `/referral/coupons?affiliateUuid=${encodeURIComponent(affiliate.uuid)}` : '#'} className="btn btn-outline-info btn-sm">
          Coupons
        </Link>
        <Link
          href={affiliate?.uuid ? `/referral/wallets?affiliateUuid=${encodeURIComponent(affiliate.uuid)}` : '#'}
          className="btn btn-outline-secondary btn-sm"
        >
          Wallets
        </Link>
        <Link
          href={wallet?.uuid ? `/referral/transactions?walletUUID=${encodeURIComponent(wallet.uuid)}` : '#'}
          className={`btn btn-outline-dark btn-sm${wallet?.uuid ? '' : ' disabled'}`}
          aria-disabled={!wallet?.uuid}
          tabIndex={wallet?.uuid ? 0 : -1}
        >
          Transactions
        </Link>
      </div>

      {loading ? <p className="mb-0">Loading affiliate...</p> : null}

      {!loading && affiliate ? (
        <>
          <div className="row mb-4">
            <div className="col-lg-4 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Affiliate Summary</h5>
                  <div className="mb-2"><strong>Name:</strong> {affiliate.fullName || '-'}</div>
                  <div className="mb-2"><strong>Type:</strong> {affiliate.type || '-'}</div>
                  <div className="mb-2"><strong>Status:</strong> {affiliate.status || '-'}</div>
                  <div className="mb-2"><strong>UUID:</strong> {affiliate.uuid || '-'}</div>
                  <div className="mb-2"><strong>Customer:</strong> {customer?.fullName || 'N/A'}</div>
                  <div className="mb-2"><strong>Email:</strong> {customer?.emailAddress || 'N/A'}</div>
                  <div className="mb-2"><strong>Phone:</strong> {customer?.phoneNumber || 'N/A'}</div>
                  <div className="mb-2"><strong>Coupons Created:</strong> {affiliate.couponsCreated ?? '-'}</div>
                  <div className="mb-2"><strong>Coupons Used:</strong> {affiliate.couponsUsed ?? '-'}</div>
                </div>
              </div>
            </div>

            <div className="col-lg-4 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Wallet</h5>
                  <div className="mb-2"><strong>Wallet UUID:</strong> {wallet?.uuid || '-'}</div>
                  <div className="mb-2"><strong>Amount:</strong> {wallet ? formatMoney(wallet.amount) : '-'}</div>
                  <div className="mb-2"><strong>Pending:</strong> {wallet ? formatMoney(wallet.amountPending) : '-'}</div>
                  <div className="mb-2"><strong>Available:</strong> {wallet ? formatMoney(wallet.amountAvailable) : '-'}</div>
                </div>
              </div>
            </div>

            <div className="col-lg-4 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">Commission</h5>
                  <div className="mb-2"><strong>Total Commission:</strong> {formatMoney(affiliate.totalCommission)}</div>
                  <div className="mb-2"><strong>Total Paid:</strong> {formatMoney(affiliate.totalPaid)}</div>
                  <div className="mb-2"><strong>Remaining Balance:</strong> {formatMoney(affiliate.remainingBalance)}</div>
                  <div className="mb-2"><strong>Created At:</strong> {formatDateTime(affiliate.createdAt)}</div>
                  <div className="mb-2"><strong>Updated At:</strong> {formatDateTime(affiliate.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Coupons</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Discount %</th>
                      <th>Orders</th>
                      <th>Total Sales</th>
                      <th>Total Commission</th>
                      <th>Expires At</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((item) => (
                      <tr key={item.uuid}>
                        <td>{item.code || '-'}</td>
                        <td>{item.discountPercentage ?? '-'}</td>
                        <td>{item.ordersCount ?? '-'}</td>
                        <td>{formatMoney(item.totalSales)}</td>
                        <td>{formatMoney(item.totalCommission)}</td>
                        <td>{formatDateTime(item.expiresAt)}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                      </tr>
                    ))}
                    {!loading && coupons.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted">
                          No coupons found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Transactions</h5>
            </div>
            <div className="card-body">
              {wallet?.uuid ? (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead>
                      <tr>
                        <th>UUID</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((item) => (
                        <tr key={item.uuid}>
                          <td>{item.uuid || '-'}</td>
                          <td>{formatMoney(item.amount)}</td>
                          <td>{item.type || '-'}</td>
                          <td>{item.description || '-'}</td>
                          <td>{formatDateTime(item.createdAt)}</td>
                        </tr>
                      ))}
                      {!loading && transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted">
                            No transactions found.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mb-0 text-muted">No wallet is attached to this affiliate.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </ReferralPageFrame>
  );
}
