'use client';

import { useCallback, useEffect, useState } from 'react';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import TransactionsSection from '@/components/referral/TransactionsSection';

function getQueryParam(name) {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get(name) || '';
}

export default function ReferralTransactionsPage() {
  const { isValid, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sort] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [wallets, setWallets] = useState([]);
  const [selectedWalletUUID, setSelectedWalletUUID] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [routeWalletUUID, setRouteWalletUUID] = useState('');
  const [routeReady, setRouteReady] = useState(false);
  const [transactionForm, setTransactionForm] = useState({
    amount: '',
    currencyCode: 'USD',
    type: 'credit',
    description: '',
  });

  const buildParams = useCallback(
    (filtersObj = {}) => {
      const params = new URLSearchParams();
      const cleanedFilters = Object.entries(filtersObj).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') acc[k] = v;
        return acc;
      }, {});

      if (Object.keys(cleanedFilters).length > 0) params.set('filters', JSON.stringify(cleanedFilters));
      if (sort) params.set('sort', sort);
      params.set('pageNumber', String(pageNumber));
      params.set('itemsPerPage', String(itemsPerPage));
      return params;
    },
    [itemsPerPage, pageNumber, sort]
  );

  useEffect(() => {
    setRouteWalletUUID(getQueryParam('walletUUID'));
    setRouteReady(true);
  }, []);

  const loadWallets = useCallback(async () => {
    if (!isValid || !routeReady) return;
    let list = [];

    if (routeWalletUUID) {
      const wallet = await apiFetch(`/api/referral/wallets/${routeWalletUUID}`, { method: 'GET' });
      list = wallet ? [wallet] : [];
    } else {
      const params = buildParams({ search });
      const data = await apiFetch(`/api/referral/wallets?${params.toString()}`, { method: 'GET' });
      list = Array.isArray(data) ? data : [];
    }

    setWallets(list);
    if (routeWalletUUID) {
      setSelectedWalletUUID(String(routeWalletUUID));
    } else if (!selectedWalletUUID && list.length > 0) {
      setSelectedWalletUUID(String(list[0].uuid || ''));
    }
  }, [apiFetch, buildParams, isValid, routeReady, routeWalletUUID, search, selectedWalletUUID]);

  const loadTransactions = useCallback(async () => {
    if (!isValid || !routeReady || !selectedWalletUUID) {
      setTransactions([]);
      return;
    }
    const params = buildParams({ search });
    const data = await apiFetch(`/api/referral/wallets/${selectedWalletUUID}/transactions?${params.toString()}`, {
      method: 'GET',
    });
    setTransactions(Array.isArray(data) ? data : []);
  }, [apiFetch, buildParams, isValid, routeReady, search, selectedWalletUUID]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadWallets();
    } catch (err) {
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  }, [loadWallets]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadTransactions().catch((err) => setError(err.message || 'Failed to load transactions.'));
  }, [loadTransactions]);

  const onCreateTransaction = async () => {
    if (!selectedWalletUUID) {
      setError('Select wallet first.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/wallets/${selectedWalletUUID}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(transactionForm.amount),
          currencyCode: transactionForm.currencyCode,
          type: transactionForm.type,
          description: transactionForm.description,
        }),
      });
      setSuccess('Transaction created.');
      setTransactionForm({ amount: '', currencyCode: 'USD', type: 'credit', description: '' });
      await loadTransactions();
      await loadWallets();
    } catch (err) {
      setError(err.message || 'Failed to create transaction.');
    }
  };

  const onReverseTransaction = async (walletUUID, uuid) => {
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/wallets/${walletUUID}/transactions/${uuid}/reverse`, { method: 'PATCH' });
      setSuccess('Transaction reversed.');
      await loadTransactions();
      await loadWallets();
    } catch (err) {
      setError(err.message || 'Failed to reverse transaction.');
    }
  };

  if (!isValid) return <div className="screen-center">Loading referral transactions...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Transactions"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <TransactionsSection
        loading={loading}
        search={search}
        setSearch={setSearch}
        wallets={wallets}
        selectedWalletUUID={selectedWalletUUID}
        setSelectedWalletUUID={setSelectedWalletUUID}
        transactionForm={transactionForm}
        setTransactionForm={setTransactionForm}
        onCreateTransaction={onCreateTransaction}
        transactions={transactions}
        onReverseTransaction={onReverseTransaction}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        onRefresh={loadData}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />
    </ReferralPageFrame>
  );
}
