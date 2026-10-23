'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';
import { formatDate, formatDateTime } from '@/lib/dateTime';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function CampaignViewPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [campaign, setCampaign] = useState(null);

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
    if (!token || !uuid) return;

    const loadCampaign = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, { method: 'GET' });
        setCampaign(data || null);
      } catch (err) {
        setError(err.message || 'Failed to load campaign.');
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [apiFetch, token, uuid]);

  const onDelete = async () => {
    const confirmed = window.confirm('Delete this campaign?');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      router.push('/campaigns');
    } catch (err) {
      setError(err.message || 'Failed to delete campaign.');
    } finally {
      setDeleting(false);
    }
  };

  const categories = Array.isArray(campaign?.campaignCategories)
    ? campaign.campaignCategories.map((entry) => entry?.category).filter(Boolean)
    : [];

  if (!isValid) {
    return <div className="screen-center">Loading campaign...</div>;
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
                  <h4 className="card-title mb-0">Campaign Details</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href="/campaigns" className="btn btn-outline-primary btn-sm">
                      Back to Campaigns
                    </Link>
                    <Link href={`/campaigns/${uuid}/edit`} className="btn btn-primary btn-sm">
                      Edit Campaign
                    </Link>
                    <button className="btn btn-outline-danger btn-sm" type="button" onClick={onDelete} disabled={deleting}>
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? (
                    <p className="mb-0">Loading campaign...</p>
                  ) : campaign ? (
                    <div className="row">
                      <div className="col-lg-8">
                        <div className="table-responsive">
                          <table className="table table-bordered">
                            <tbody>
                              <tr>
                                <th style={{ width: '220px' }}>UUID</th>
                                <td>{campaign.uuid || '-'}</td>
                              </tr>
                              <tr>
                                <th>Name (EN)</th>
                                <td>{campaign.nameEn || campaign.name?.en || '-'}</td>
                              </tr>
                              <tr>
                                <th>Name (AR)</th>
                                <td>{campaign.nameAr || campaign.name?.ar || '-'}</td>
                              </tr>
                              <tr>
                                <th>Brief (EN)</th>
                                <td>{campaign.briefEn || campaign.brief?.en || '-'}</td>
                              </tr>
                              <tr>
                                <th>Brief (AR)</th>
                                <td>{campaign.briefAr || campaign.brief?.ar || '-'}</td>
                              </tr>
                              <tr>
                                <th>Slug</th>
                                <td>{campaign.slug || '-'}</td>
                              </tr>
                              <tr>
                                <th>Pricing Factor</th>
                                <td>{campaign.pricingFactor ?? '-'}</td>
                              </tr>
                              <tr>
                                <th>Discount Percentage</th>
                                <td>{campaign.discountPercentage ?? '-'}</td>
                              </tr>
                              <tr>
                                <th>Starts At</th>
                                <td>{formatDate(campaign.startsAt)}</td>
                              </tr>
                              <tr>
                                <th>Finishes At</th>
                                <td>{formatDate(campaign.finishesAt)}</td>
                              </tr>
                              <tr>
                                <th>Featured</th>
                                <td>{campaign.isFeatured ? 'Yes' : 'No'}</td>
                              </tr>
                              <tr>
                                <th>Active</th>
                                <td>{campaign.isActive ? 'Yes' : 'No'}</td>
                              </tr>
                              <tr>
                                <th>Created At</th>
                                <td>{formatDateTime(campaign.createdAt)}</td>
                              </tr>
                              <tr>
                                <th>Updated At</th>
                                <td>{formatDateTime(campaign.updatedAt)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="col-lg-4">
                        <div className="card bg-light border-0" style={{ borderRadius: '24px' }}>
                          <div className="card-body" style={{ padding: '28px' }}>
                            <h5 className="card-title">Categories</h5>
                            {categories.length > 0 ? (
                              <div className="d-flex flex-column" style={{ gap: '12px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                                {categories.map((category) => (
                                  <span
                                    key={category.uuid}
                                    className="badge badge-primary"
                                    style={{
                                      display: 'inline-flex',
                                      width: 'fit-content',
                                      maxWidth: '100%',
                                      whiteSpace: 'normal',
                                      textAlign: 'left',
                                      lineHeight: 1.35,
                                      padding: '12px 18px',
                                      borderRadius: '999px',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {category.nameEn || category.name || 'Unnamed'}
                                    {category.slug ? ` (${category.slug})` : ''}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mb-0 text-muted small">No categories attached.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
