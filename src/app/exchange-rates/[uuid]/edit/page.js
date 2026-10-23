'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function EditExchangeRatePage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;

  const [menuToggled, setMenuToggled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    srcCurrencyCode: '',
    targetCurrencyCode: '',
    factor: '',
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
        const backendError = payload?.errors?.error || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }
      return payload;
    },
    [token]
  );

  useEffect(() => {
    if (!token || !uuid) return;
    const loadRate = async () => {
      setLoading(true);
      setError('');
      try {
        const rate = await apiFetch(`/api/exchange-rates/${uuid}`, { method: 'GET' });
        setFormData({
          srcCurrencyCode: rate?.srcCurrencyCode || '',
          targetCurrencyCode: rate?.targetCurrencyCode || '',
          factor: String(rate?.factor ?? ''),
        });
      } catch (err) {
        setError(err.message || 'Failed to load exchange rate.');
      } finally {
        setLoading(false);
      }
    };
    loadRate();
  }, [apiFetch, token, uuid]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.srcCurrencyCode.trim() || !formData.targetCurrencyCode.trim() || !formData.factor.trim()) {
      setError('Source currency, target currency and factor are required.');
      return;
    }

    const factor = Number(formData.factor);
    if (!Number.isFinite(factor) || factor <= 0) {
      setError('Factor must be a number greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch(`/api/exchange-rates/${uuid}`, {
        method: 'PUT',
        body: JSON.stringify({
          srcCurrencyCode: formData.srcCurrencyCode.trim().toLowerCase(),
          targetCurrencyCode: formData.targetCurrencyCode.trim().toLowerCase(),
          factor,
        }),
      });
      router.push(`/exchange-rates/${uuid}`);
    } catch (err) {
      setError(err.message || 'Failed to update exchange rate.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) return <div className="screen-center">Loading exchange rate form...</div>;

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
                  <h4 className="card-title mb-0">Edit Exchange Rate</h4>
                  <div className="d-flex" style={{ gap: '8px' }}>
                    <Link href={`/exchange-rates/${uuid}`} className="btn btn-outline-dark btn-sm">
                      View
                    </Link>
                    <Link href="/exchange-rates" className="btn btn-outline-primary btn-sm">
                      Back to Exchange Rates
                    </Link>
                  </div>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {loading ? <p className="mb-0">Loading exchange rate...</p> : null}

                  {!loading ? (
                    <form onSubmit={onSubmit}>
                      <div className="row">
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Source Currency Code</label>
                          <input
                            className="form-control"
                            name="srcCurrencyCode"
                            value={formData.srcCurrencyCode}
                            onChange={onChange}
                            maxLength={8}
                            required
                          />
                        </div>
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Target Currency Code</label>
                          <input
                            className="form-control"
                            name="targetCurrencyCode"
                            value={formData.targetCurrencyCode}
                            onChange={onChange}
                            maxLength={8}
                            required
                          />
                        </div>
                        <div className="col-md-4 mb-3">
                          <label className="form-label">Factor</label>
                          <input
                            className="form-control"
                            name="factor"
                            value={formData.factor}
                            onChange={onChange}
                            type="number"
                            step="0.0001"
                            min="0"
                            required
                          />
                        </div>
                      </div>

                      <div className="d-flex" style={{ gap: '8px' }}>
                        <button className="btn btn-primary" type="submit" disabled={submitting}>
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href={`/exchange-rates/${uuid}`} className="btn btn-light">
                          Cancel
                        </Link>
                      </div>
                    </form>
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

