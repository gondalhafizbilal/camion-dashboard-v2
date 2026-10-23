'use client';

import { useCallback, useEffect, useState } from 'react';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import WalletsSection from '@/components/referral/WalletsSection';

function getQueryParam(name) {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get(name) || '';
}

export default function ReferralWalletsPage() {
  const { isValid, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success] = useState('');
  const [search, setSearch] = useState('');
  const [sort] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [wallets, setWallets] = useState([]);
  const [routeAffiliateUUID, setRouteAffiliateUUID] = useState('');
  const [routeReady, setRouteReady] = useState(false);

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
    setRouteAffiliateUUID(getQueryParam('affiliateUuid'));
    setRouteReady(true);
  }, []);

  const loadWallets = useCallback(async () => {
    if (!isValid || !routeReady) return;
    setLoading(true);
    setError('');
    try {
      const params = buildParams({ search, affiliateUUID: routeAffiliateUUID });
      const data = await apiFetch(`/api/referral/wallets?${params.toString()}`, { method: 'GET' });
      setWallets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load wallets.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, buildParams, isValid, routeAffiliateUUID, routeReady, search]);

  useEffect(() => {
    loadWallets();
  }, [loadWallets]);

  if (!isValid) return <div className="screen-center">Loading referral wallets...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Wallets"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <WalletsSection
        loading={loading}
        search={search}
        setSearch={setSearch}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        onRefresh={loadWallets}
        wallets={wallets}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />
    </ReferralPageFrame>
  );
}
