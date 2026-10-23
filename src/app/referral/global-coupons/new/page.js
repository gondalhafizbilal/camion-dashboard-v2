'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useAdminPage from '@/components/referral/useAdminPage';
import ReferralPageFrame from '@/components/referral/ReferralPageFrame';
import GlobalCouponForm from '@/components/referral/GlobalCouponForm';
import { normalizeErrors } from '@/components/referral/GlobalCouponsSection';

export default function NewGlobalCouponPage() {
  const router = useRouter();
  const { isValid, token, menuToggled, setMenuToggled, fullName, role } = useAdminPage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
      const response = await fetch('/api/referral/global-coupons', {
        method: 'POST',
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
        throw new Error(mappedErrors.error || 'Failed to create global coupon.');
      }

      setSuccess('Global coupon created.');
      if (payload?.uuid) {
        router.replace(`/referral/global-coupons/${payload.uuid}/edit`);
      } else {
        router.replace('/referral/global-coupons');
      }
    } catch (err) {
      setError(err.message || 'Failed to create global coupon.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading global coupon form...</div>;

  return (
    <ReferralPageFrame
      title="Referral - New Global Coupon"
      menuToggled={menuToggled}
      setMenuToggled={setMenuToggled}
      fullName={fullName}
      role={role}
      error={error}
      success={success}
    >
      <GlobalCouponForm
        title="Create Global Coupon"
        loading={false}
        submitting={submitting}
        error={error}
        success={success}
        formData={formData}
        setFormData={setFormData}
        fieldErrors={fieldErrors}
        onSubmit={onSubmit}
        backHref="/referral/global-coupons"
        mode="create"
      />
    </ReferralPageFrame>
  );
}
