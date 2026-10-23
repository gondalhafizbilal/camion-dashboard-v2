'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import GlobalCouponForm from '@/components/referral/GlobalCouponForm';
import { normalizeErrors } from '@/components/referral/GlobalCouponsSection';
import { formatDateTime } from '@/lib/dateTime';

function formatDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function getDiscountDisplay(coupon) {
  const type = String(coupon?.discountType || '').toLowerCase();
  if (type === 'percentage') return `${coupon?.discountPercentage ?? '-'}%`;
  if (type === 'fixed') return coupon?.discountValue ?? '-';
  return coupon?.discountPercentage ?? coupon?.discountValue ?? '-';
}

export default function EditGlobalCouponPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = String(params?.uuid || '').trim();
  const { isValid, token, menuToggled, setMenuToggled, fullName, role, apiFetch } = useAdminPage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountPercentage: '',
    discountValue: '',
    usageLimit: '',
    expiresAt: '',
  });
  const [fieldErrors, setFieldErrors] = useState({
    code: '',
    discountType: '',
    discountPercentage: '',
    discountValue: '',
    usageLimit: '',
    expiresAt: '',
  });

  const discountType = String(formData.discountType || '').toLowerCase();
  const isPercentage = discountType === 'percentage';
  const isFixed = discountType === 'fixed';

  useEffect(() => {
    if (!isValid) {
      router.replace('/login');
    }
  }, [isValid, router]);

  const loadCoupon = useCallback(async () => {
    if (!isValid || !uuid) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/referral/global-coupons/${encodeURIComponent(uuid)}`, { method: 'GET' });
      setCoupon(data || null);
      setFormData({
        code: data?.code || '',
        discountType: data?.discountType || 'percentage',
        discountPercentage: String(data?.discountType || '').toLowerCase() === 'percentage' ? (data?.discountPercentage ?? '') : '1',
        discountValue: String(data?.discountType || '').toLowerCase() === 'fixed' ? (data?.discountValue ?? '') : '1',
        usageLimit: data?.usageLimit ?? '',
        expiresAt: formatDateInput(data?.expiresAt),
      });
    } catch (err) {
      setError(err.message || 'Failed to load global coupon.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isValid, uuid]);

  useEffect(() => {
    loadCoupon();
  }, [loadCoupon]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const nextFieldErrors = { code: '', discountType: '', discountPercentage: '', discountValue: '', usageLimit: '', expiresAt: '' };
    if (!String(formData.code || '').trim()) nextFieldErrors.code = 'Code is required.';
    if (!String(formData.discountType || '').trim()) nextFieldErrors.discountType = 'Discount type is required.';
    if (isPercentage && !String(formData.discountPercentage || '').trim()) nextFieldErrors.discountPercentage = 'Discount percentage is required.';
    if (isFixed && !String(formData.discountValue || '').trim()) nextFieldErrors.discountValue = 'Discount value is required.';
    if (!String(formData.usageLimit || '').trim()) nextFieldErrors.usageLimit = 'Usage limit is required.';
    if (!String(formData.expiresAt || '').trim()) nextFieldErrors.expiresAt = 'Expiry date is required.';

    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setFieldErrors({ code: '', discountType: '', discountPercentage: '', discountValue: '', usageLimit: '', expiresAt: '' });

    try {
      const response = await fetch(`/api/referral/global-coupons/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${token || ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          code: String(formData.code).trim(),
          discountType: String(formData.discountType).trim(),
          discountPercentage: isPercentage ? Number(formData.discountPercentage) : 1,
          discountValue: isFixed ? Number(formData.discountValue) : 1,
          usageLimit: Number(formData.usageLimit),
          expiresAt: formData.expiresAt,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const mappedErrors = normalizeErrors(payload);
        setFieldErrors({
          code: mappedErrors.code || '',
          discountType: mappedErrors.discountType || '',
          discountPercentage: mappedErrors.discountPercentage || '',
          discountValue: mappedErrors.discountValue || '',
          usageLimit: mappedErrors.usageLimit || '',
          expiresAt: mappedErrors.expiresAt || '',
        });
        throw new Error(mappedErrors.error || 'Failed to update global coupon.');
      }

      setSuccess('Global coupon updated.');
      setCoupon(payload || null);
    } catch (err) {
      setError(err.message || 'Failed to update global coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this global coupon?')) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/api/referral/global-coupons/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      router.push('/referral/global-coupons');
    } catch (err) {
      setError(err.message || 'Failed to delete global coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  const extraDetails = coupon ? (
    <div className="table-responsive mb-3">
      <table className="table table-bordered mb-0">
        <tbody>
          <tr>
            <th style={{ width: '220px' }}>UUID</th>
            <td>{coupon.uuid || '-'}</td>
          </tr>
          <tr>
            <th>Orders Count</th>
            <td>{coupon.ordersCount ?? '-'}</td>
          </tr>
          <tr>
            <th>Discount Type</th>
            <td>{coupon.discountType || '-'}</td>
          </tr>
          <tr>
            <th>Total Sales</th>
            <td>{coupon.totalSales ? `${coupon.totalSales.currencyCode || ''} ${coupon.totalSales.amount ?? 0}`.trim() : '-'}</td>
          </tr>
          <tr>
            <th>Discount</th>
            <td>{getDiscountDisplay(coupon)}</td>
          </tr>
          <tr>
            <th>Usage Limit</th>
            <td>{coupon.usageLimit ?? '-'}</td>
          </tr>
          <tr>
            <th>Total Commission</th>
            <td>
              {coupon.totalCommission ? `${coupon.totalCommission.currencyCode || ''} ${coupon.totalCommission.amount ?? 0}`.trim() : '-'}
            </td>
          </tr>
          <tr>
            <th>Created At</th>
            <td>{formatDateTime(coupon.createdAt)}</td>
          </tr>
          <tr>
            <th>Updated At</th>
            <td>{formatDateTime(coupon.updatedAt)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  ) : null;

  if (!isValid) return <div className="screen-center">Loading global coupon...</div>;

  return (
    <ReferralPageFrame
      title="Referral - Global Coupon"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <div className="d-flex mb-3" style={{ gap: '8px' }}>
        <Link href="/referral/global-coupons" className="btn btn-outline-primary btn-sm">
          Back to Global Coupons
        </Link>
      </div>

      <GlobalCouponForm
        title="Edit Global Coupon"
        loading={loading}
        submitting={submitting}
        error={error}
        success={success}
        formData={formData}
        setFormData={setFormData}
        fieldErrors={fieldErrors}
        onSubmit={onSubmit}
        onDelete={onDelete}
        backHref="/referral/global-coupons"
        mode="edit"
        extraDetails={extraDetails}
      />
    </ReferralPageFrame>
  );
}
