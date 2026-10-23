'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import GlobalCouponsSection from '@/components/referral/GlobalCouponsSection';

export default function ReferralGlobalCouponsPage() {
  const { isValid, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [coupons, setCoupons] = useState([]);

  const loadCoupons = useCallback(async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/referral/global-coupons', { method: 'GET' });
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load global coupons.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isValid]);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const filteredCoupons = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    const sorted = [...coupons].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
    if (!query) return sorted;
    return sorted
      .filter((item) => {
        const text = [
          item?.code,
          item?.discountType,
          item?.discountPercentage,
          item?.discountValue,
          item?.usageLimit,
          item?.ordersCount,
          item?.expiresAt,
          item?.createdAt,
          item?.updatedAt,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return text.includes(query);
      })
      ;
  }, [coupons, search]);

  const onDeleteCoupon = async (uuid) => {
    if (!window.confirm('Delete this global coupon?')) return;
    try {
      setError('');
      setSuccess('');
      await apiFetch(`/api/referral/global-coupons/${uuid}`, { method: 'DELETE' });
      setSuccess('Global coupon deleted.');
      await loadCoupons();
    } catch (err) {
      setError(err.message || 'Failed to delete global coupon.');
    }
  };

  if (!isValid) return <div className="screen-center">Loading referral global coupons...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Global Coupons"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <GlobalCouponsSection
        loading={loading}
        search={search}
        setSearch={setSearch}
        onRefresh={loadCoupons}
        coupons={filteredCoupons}
        onDeleteCoupon={onDeleteCoupon}
      />
    </ReferralPageFrame>
  );
}
