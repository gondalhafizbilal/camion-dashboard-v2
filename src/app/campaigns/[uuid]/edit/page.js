'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import CampaignForm, { normalizeCampaignErrors } from '@/components/campaigns/CampaignForm';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [formData, setFormData] = useState({
    nameEn: '',
    nameAr: '',
    briefEn: '',
    briefAr: '',
    slug: '',
    pricingFactor: '',
    discountPercentage: '',
    urgencyEnabled: false,
    urgencyMinStockCount: '',
    urgencyMaxStockCount: '',
    startsAt: '',
    finishesAt: '',
    isFeatured: false,
  });

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  useEffect(() => {
    if (!isValid) {
      clearAuth();
      router.replace('/login');
      return;
    }

    const body = document.body;
    body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');

    const onResize = () => {
      body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isValid, router]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

      if (options.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw toApiError(payload, response, 'Request failed.');
      }

      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token) return;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const data = await apiFetch('/api/categories?itemsPerPage=500&pageNumber=1', { method: 'GET' });
        setCategoryOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load categories.');
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [apiFetch, token]);

  useEffect(() => {
    if (!token || !uuid) return;

    const loadCampaign = async () => {
      setLoading(true);
      setError('');
      try {
        const campaign = await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, { method: 'GET' });
        setFormData({
          nameEn: campaign?.nameEn || campaign?.name?.en || '',
          nameAr: campaign?.nameAr || campaign?.name?.ar || '',
          briefEn: campaign?.briefEn || campaign?.brief?.en || '',
          briefAr: campaign?.briefAr || campaign?.brief?.ar || '',
          slug: campaign?.slug || '',
          pricingFactor: campaign?.pricingFactor ?? '',
          discountPercentage: campaign?.discountPercentage ?? '',
          urgencyEnabled: Boolean(campaign?.urgencyEnabled),
          urgencyMinStockCount: campaign?.urgencyMinStockCount ?? '',
          urgencyMaxStockCount: campaign?.urgencyMaxStockCount ?? '',
          startsAt: String(campaign?.startsAt || '').slice(0, 10),
          finishesAt: String(campaign?.finishesAt || '').slice(0, 10),
          isFeatured: Boolean(campaign?.isFeatured),
        });
        setSelectedCategories(
          Array.isArray(campaign?.campaignCategories)
            ? campaign.campaignCategories.map((entry) => entry?.category?.uuid).filter(Boolean)
            : []
        );
      } catch (err) {
        setError(err.message || 'Failed to load campaign.');
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      if (name === 'nameEn') delete next['name.en'];
      if (name === 'nameAr') delete next['name.ar'];
      if (name === 'briefEn') delete next['brief.en'];
      if (name === 'briefAr') delete next['brief.ar'];
      if (name === 'urgencyMinStockCount') delete next['urgencyMinStockCount'];
      if (name === 'urgencyMaxStockCount') delete next['urgencyMaxStockCount'];
      return next;
    });
  };

  const onToggleUrgency = (enabled) => {
    setFormData((prev) => ({
      ...prev,
      urgencyEnabled: enabled,
      urgencyMinStockCount: enabled ? prev.urgencyMinStockCount : '',
      urgencyMaxStockCount: enabled ? prev.urgencyMaxStockCount : '',
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.urgencyEnabled;
      delete next.urgencyMinStockCount;
      delete next.urgencyMaxStockCount;
      delete next.minStockCount;
      delete next.maxStockCount;
      return next;
    });
  };

  const onUrgencyChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next.minStockCount;
      delete next.maxStockCount;
      return next;
    });
  };

  const onToggleCategory = (categoryUUID, checked) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(categoryUUID);
      if (checked && !exists) return [...prev, categoryUUID];
      if (!checked && exists) return prev.filter((item) => item !== categoryUUID);
      return prev;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.categories;
      return next;
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setFieldErrors({});

    const pricingFactorNumber = Number(formData.pricingFactor);

    if (
      !formData.nameEn.trim() ||
      !formData.nameAr.trim() ||
      !formData.briefEn.trim() ||
      !formData.briefAr.trim() ||
      !formData.slug.trim() ||
      !formData.pricingFactor ||
      !formData.discountPercentage ||
      !formData.startsAt ||
      !formData.finishesAt
    ) {
      setError('All campaign fields are required.');
      return;
    }

    if (Number.isNaN(pricingFactorNumber) || pricingFactorNumber < 1) {
      setError('Pricing factor must be at least 1.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: { en: formData.nameEn.trim(), ar: formData.nameAr.trim() },
          brief: { en: formData.briefEn.trim(), ar: formData.briefAr.trim() },
          slug: formData.slug.trim(),
          pricingFactor: pricingFactorNumber,
          discountPercentage: Number(formData.discountPercentage),
          startsAt: formData.startsAt,
          finishesAt: formData.finishesAt,
          isFeatured: Boolean(formData.isFeatured),
          categories: selectedCategories,
        }),
      });

      await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}/urgency`, {
        method: 'PUT',
        body: JSON.stringify({
          enabled: Boolean(formData.urgencyEnabled),
          minStockCount: formData.urgencyEnabled ? Number(formData.urgencyMinStockCount || 0) : 0,
          maxStockCount: formData.urgencyEnabled ? Number(formData.urgencyMaxStockCount || 0) : 0,
        }),
      });

      setMessage('Campaign updated.');
    } catch (err) {
      setFieldErrors(normalizeCampaignErrors(err?.payload || {}));
      setError(err.message || 'Failed to update campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    const confirmed = window.confirm('Delete this campaign?');
    if (!confirmed) return;

    setSubmitting(true);
    setError('');
    try {
      await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      router.push('/campaigns');
    } catch (err) {
      setError(err.message || 'Failed to delete campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading campaigns...</div>;
  }

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h4 className="card-title mb-0">Edit Campaign</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href="/campaigns" className="btn btn-outline-primary btn-sm">
                      Back to Campaigns
                    </Link>
                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={onDelete} disabled={submitting}>
                      Delete
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}
                  {loading ? <p className="mb-0">Loading campaign...</p> : null}

                  {!loading ? (
                    <CampaignForm
                      title="Campaign Details"
                      backHref="/campaigns"
                      submitLabel={submitting ? 'Saving...' : 'Save Campaign'}
                      submitting={submitting}
                      error={''}
                      fieldErrors={fieldErrors}
                      formData={formData}
                      onChange={onChange}
                      onSubmit={onSubmit}
                      categoryOptions={categoryOptions}
                      loadingCategories={loadingCategories}
                      categorySearch={categorySearch}
                      setCategorySearch={setCategorySearch}
                      selectedCategories={selectedCategories}
                      onToggleCategory={onToggleCategory}
                      urgencyEnabled={formData.urgencyEnabled}
                      urgencyMinStockCount={formData.urgencyMinStockCount}
                      urgencyMaxStockCount={formData.urgencyMaxStockCount}
                      onToggleUrgency={onToggleUrgency}
                      onUrgencyChange={onUrgencyChange}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
