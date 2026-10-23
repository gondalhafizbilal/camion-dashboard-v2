'use client';

import { useCallback, useEffect, useState } from 'react';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import CouponsSection from '@/components/referral/CouponsSection';

function getQueryParam(name) {
  if (typeof window === 'undefined') return '';
  return new URL(window.location.href).searchParams.get(name) || '';
}

export default function ReferralCouponsPage() {
  const { isValid, token, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sort] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [coupons, setCoupons] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [affiliatesLoading, setAffiliatesLoading] = useState(false);
  const [routeAffiliateUUID, setRouteAffiliateUUID] = useState('');
  const [routeReady, setRouteReady] = useState(false);
  const [createForm, setCreateForm] = useState({
    affiliateUuid: '',
    code: '',
    discountPercentage: '',
    expiresAt: '',
  });
  const [createFieldErrors, setCreateFieldErrors] = useState({
    affiliateUuid: '',
    code: '',
    discountPercentage: '',
    expiresAt: '',
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
    setRouteAffiliateUUID(getQueryParam('affiliateUuid'));
    setRouteReady(true);
  }, []);

  const loadCoupons = useCallback(async () => {
    if (!isValid || !routeReady) return;
    setLoading(true);
    setError('');
    try {
      const params = buildParams({ search, affiliateUUID: routeAffiliateUUID });
      const data = await apiFetch(`/api/referral/coupons?${params.toString()}`, { method: 'GET' });
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, buildParams, isValid, routeAffiliateUUID, routeReady, search]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  useEffect(() => {
    if (!routeReady || !routeAffiliateUUID) return;
    setCreateForm((prev) => (prev.affiliateUuid ? prev : { ...prev, affiliateUuid: routeAffiliateUUID }));
  }, [routeAffiliateUUID, routeReady]);

  const loadAffiliates = useCallback(async () => {
    if (!isValid) return;
    setAffiliatesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('pageNumber', '1');
      params.set('itemsPerPage', '100');
      const data = await apiFetch(`/api/referral/affiliates?${params.toString()}`, { method: 'GET' });
      setAffiliates(Array.isArray(data) ? data : []);
    } catch {
      setAffiliates([]);
    } finally {
      setAffiliatesLoading(false);
    }
  }, [apiFetch, isValid]);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  const onDeleteCoupon = async (uuid) => {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/coupons/${uuid}`, { method: 'DELETE' });
      setSuccess('Coupon deleted.');
      await loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to delete coupon.');
    }
  };

  const onCreateCoupon = async () => {
    const nextFieldErrors = {
      affiliateUuid: '',
      code: '',
      discountPercentage: '',
      expiresAt: '',
    };

    if (!String(createForm.affiliateUuid || '').trim()) {
      nextFieldErrors.affiliateUuid = 'Affiliate UUID is required.';
    }
    if (!String(createForm.code || '').trim()) {
      nextFieldErrors.code = 'Code is required.';
    }
    if (!String(createForm.discountPercentage || '').trim()) {
      nextFieldErrors.discountPercentage = 'Discount percentage is required.';
    }
    if (!String(createForm.expiresAt || '').trim()) {
      nextFieldErrors.expiresAt = 'Expiry date is required.';
    }

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setCreateFieldErrors(nextFieldErrors);
      return;
    }

    setCreateLoading(true);
    setError('');
    setSuccess('');
    setCreateFieldErrors({
      affiliateUuid: '',
      code: '',
      discountPercentage: '',
      expiresAt: '',
    });

    try {
      const response = await fetch(
        `/api/referral/affiliates/${encodeURIComponent(String(createForm.affiliateUuid).trim())}/coupons`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token || ''}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            code: String(createForm.code).trim(),
            discountPercentage: Number(createForm.discountPercentage),
            expiresAt: createForm.expiresAt,
          }),
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const backendErrors = payload?.errors || {};
        const mappedErrors = {
          affiliateUuid:
            backendErrors?.affiliateUuid || backendErrors?.affiliateUUID || backendErrors?.affiliate || '',
          code: backendErrors?.code || '',
          discountPercentage: backendErrors?.discountPercentage || '',
          expiresAt: backendErrors?.expiresAt || '',
        };
        if (Object.values(mappedErrors).some(Boolean)) {
          setCreateFieldErrors((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(mappedErrors).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])
            ),
          }));
        }
        throw new Error(payload?.errors?.error || payload?.message || 'Failed to create coupon.');
      }

      setSuccess('Coupon created successfully.');
      setCreateForm({
        affiliateUuid: '',
        code: '',
        discountPercentage: '',
        expiresAt: '',
      });
      await loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to create coupon.');
    } finally {
      setCreateLoading(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading referral coupons...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Coupons"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <CouponsSection
        loading={loading}
        createLoading={createLoading}
        affiliates={affiliates}
        affiliatesLoading={affiliatesLoading}
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        createForm={createForm}
        setCreateForm={setCreateForm}
        createFieldErrors={createFieldErrors}
        onCreateCoupon={onCreateCoupon}
        search={search}
        setSearch={setSearch}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        onRefresh={loadCoupons}
        coupons={coupons}
        onDeleteCoupon={onDeleteCoupon}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />
    </ReferralPageFrame>
  );
}
