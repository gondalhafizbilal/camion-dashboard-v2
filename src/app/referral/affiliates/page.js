'use client';

import { useCallback, useEffect, useState } from 'react';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import AffiliatesSection from '@/components/referral/AffiliatesSection';

export default function ReferralAffiliatesPage() {
  const { isValid, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sort] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [affiliateTypeFilter, setAffiliateTypeFilter] = useState('');
  const [affiliateStatusFilter, setAffiliateStatusFilter] = useState('');
  const [affiliates, setAffiliates] = useState([]);

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

  const loadAffiliates = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const params = buildParams({
        search,
        type: affiliateTypeFilter,
        status: affiliateStatusFilter,
      });
      const data = await apiFetch(`/api/referral/affiliates?${params.toString()}`, { method: 'GET' });
      setAffiliates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load affiliates.');
    } finally {
      setLoading(false);
    }
  }, [affiliateStatusFilter, affiliateTypeFilter, apiFetch, buildParams, isValid, search]);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  const onUpdateAffiliateStatus = async (uuid, status) => {
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/affiliates/${uuid}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSuccess('Affiliate status updated.');
      await loadAffiliates();
    } catch (err) {
      setError(err.message || 'Failed to update affiliate status.');
    }
  };

  const onUpdateAffiliateType = async (uuid, type) => {
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/affiliates/${uuid}/type`, {
        method: 'PATCH',
        body: JSON.stringify({ type }),
      });
      setSuccess('Affiliate type updated.');
      await loadAffiliates();
    } catch (err) {
      setError(err.message || 'Failed to update affiliate type.');
    }
  };

  const onDeleteAffiliate = async (uuid) => {
    if (!window.confirm('Delete this affiliate?')) return;
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/affiliates/${uuid}`, { method: 'DELETE' });
      setSuccess('Affiliate deleted.');
      await loadAffiliates();
    } catch (err) {
      setError(err.message || 'Failed to delete affiliate.');
    }
  };

  if (!isValid) return <div className="screen-center">Loading referral affiliates...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Affiliates"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <AffiliatesSection
        loading={loading}
        search={search}
        setSearch={setSearch}
        affiliateTypeFilter={affiliateTypeFilter}
        setAffiliateTypeFilter={setAffiliateTypeFilter}
        affiliateStatusFilter={affiliateStatusFilter}
        setAffiliateStatusFilter={setAffiliateStatusFilter}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        onRefresh={loadAffiliates}
        affiliates={affiliates}
        onUpdateAffiliateStatus={onUpdateAffiliateStatus}
        onUpdateAffiliateType={onUpdateAffiliateType}
        onDeleteAffiliate={onDeleteAffiliate}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />
    </ReferralPageFrame>
  );
}
