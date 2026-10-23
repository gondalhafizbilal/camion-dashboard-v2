'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import CampaignsSection from '@/components/campaigns/CampaignsSection';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function CampaignsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [deletingUUID, setDeletingUUID] = useState('');
  const [showUrgencyModal, setShowUrgencyModal] = useState(false);
  const [urgencySavingUUID, setUrgencySavingUUID] = useState('');
  const [urgencyModalData, setUrgencyModalData] = useState({
    uuid: '',
    name: '',
    enabled: false,
    minStockCount: '',
    maxStockCount: '',
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

  const loadCampaigns = useCallback(
    async (nextPageNumber = 1) => {
      if (!token) return;
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        params.set('pageNumber', String(nextPageNumber));
        params.set('itemsPerPage', String(itemsPerPage));
        const data = await apiFetch(`/api/campaigns?${params.toString()}`, { method: 'GET' });
        const rows = Array.isArray(data) ? data : [];
        setCampaigns(rows);
        setHasMore(rows.length === itemsPerPage);
      } catch (err) {
        setError(err.message || 'Failed to load campaigns.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, itemsPerPage, token]
  );

  useEffect(() => {
    loadCampaigns(1);
  }, [loadCampaigns]);

  const onDeleteCampaign = async (uuid) => {
    if (!uuid) return;
    const confirmed = window.confirm('Delete this campaign?');
    if (!confirmed) return;

    setDeletingUUID(uuid);
    setError('');
    try {
      await apiFetch(`/api/campaigns/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
      await loadCampaigns(pageNumber);
    } catch (err) {
      setError(err.message || 'Failed to delete campaign.');
    } finally {
      setDeletingUUID('');
    }
  };

  const openUrgencyModal = (campaign) => {
    setUrgencyModalData({
      uuid: campaign?.uuid || '',
      name: campaign?.nameEn || campaign?.name?.en || campaign?.slug || '',
      enabled: Boolean(campaign?.urgencyEnabled),
      minStockCount:
        campaign?.urgencyMinStockCount !== null && campaign?.urgencyMinStockCount !== undefined
          ? String(campaign.urgencyMinStockCount)
          : '',
      maxStockCount:
        campaign?.urgencyMaxStockCount !== null && campaign?.urgencyMaxStockCount !== undefined
          ? String(campaign.urgencyMaxStockCount)
          : '',
    });
    setShowUrgencyModal(true);
  };

  const onUpdateUrgency = async () => {
    if (!urgencyModalData.uuid) return;
    if (urgencyModalData.enabled) {
      const minValue = Number(urgencyModalData.minStockCount);
      const maxValue = Number(urgencyModalData.maxStockCount);
      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        setError('Enter valid urgency stock values.');
        return;
      }
      if (minValue < 0 || maxValue < 0) {
        setError('Urgency stock values must be zero or greater.');
        return;
      }
      if (minValue > maxValue) {
        setError('Minimum stock count cannot be greater than maximum stock count.');
        return;
      }
    }

    setUrgencySavingUUID(urgencyModalData.uuid);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/campaigns/${encodeURIComponent(urgencyModalData.uuid)}/urgency`, {
        method: 'PUT',
        body: JSON.stringify(
          urgencyModalData.enabled
            ? {
                enabled: true,
                minStockCount: Number(urgencyModalData.minStockCount),
                maxStockCount: Number(urgencyModalData.maxStockCount),
              }
            : { enabled: false }
        ),
      });
      setMessage('Campaign urgency updated.');
      setShowUrgencyModal(false);
      await loadCampaigns(pageNumber);
    } catch (err) {
      setError(err.message || 'Failed to update campaign urgency.');
    } finally {
      setUrgencySavingUUID('');
    }
  };

  const onPrev = async () => {
    const nextPage = Math.max(1, pageNumber - 1);
    setPageNumber(nextPage);
    await loadCampaigns(nextPage);
  };

  const onNext = async () => {
    const nextPage = pageNumber + 1;
    setPageNumber(nextPage);
    await loadCampaigns(nextPage);
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
                <div className="card-body">
                  <CampaignsSection
                    campaigns={campaigns}
                    loading={loading}
                    error={error}
                    onRefresh={() => loadCampaigns(pageNumber)}
                    onDeleteCampaign={onDeleteCampaign}
                    onUpdateUrgency={openUrgencyModal}
                  />

                  <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap" style={{ gap: '8px' }}>
                    <small className="text-muted">Page {pageNumber}</small>
                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-light btn-sm" type="button" disabled={loading || pageNumber <= 1} onClick={onPrev}>
                        Prev
                      </button>
                      <button className="btn btn-light btn-sm" type="button" disabled={loading || !hasMore} onClick={onNext}>
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUrgencyModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Update Campaign Urgency</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowUrgencyModal(false)}
                    disabled={urgencySavingUUID === urgencyModalData.uuid}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label mb-1">Campaign</label>
                    <div className="form-control bg-light">{urgencyModalData.name || '-'}</div>
                  </div>
                  <div className="form-check mb-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="campaignUrgencyEnabledListing"
                      checked={urgencyModalData.enabled}
                      onChange={(e) =>
                        setUrgencyModalData((prev) => ({
                          ...prev,
                          enabled: e.target.checked,
                          minStockCount: e.target.checked ? prev.minStockCount : '',
                          maxStockCount: e.target.checked ? prev.maxStockCount : '',
                        }))
                      }
                      disabled={urgencySavingUUID === urgencyModalData.uuid}
                    />
                    <label className="form-check-label" htmlFor="campaignUrgencyEnabledListing">
                      Enable campaign urgency
                    </label>
                  </div>
                  {urgencyModalData.enabled ? (
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Min Stock Count</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-control"
                          value={urgencyModalData.minStockCount}
                          onChange={(e) =>
                            setUrgencyModalData((prev) => ({
                              ...prev,
                              minStockCount: e.target.value,
                            }))
                          }
                          disabled={urgencySavingUUID === urgencyModalData.uuid}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Max Stock Count</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="form-control"
                          value={urgencyModalData.maxStockCount}
                          onChange={(e) =>
                            setUrgencyModalData((prev) => ({
                              ...prev,
                              maxStockCount: e.target.value,
                            }))
                          }
                          disabled={urgencySavingUUID === urgencyModalData.uuid}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowUrgencyModal(false)}
                    disabled={urgencySavingUUID === urgencyModalData.uuid}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={!urgencyModalData.uuid || urgencySavingUUID === urgencyModalData.uuid}
                    onClick={onUpdateUrgency}
                  >
                    {urgencySavingUUID === urgencyModalData.uuid ? 'Updating...' : 'Update Urgency'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}

      <Footer />
    </div>
  );
}
