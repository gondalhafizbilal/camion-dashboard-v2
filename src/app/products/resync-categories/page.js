'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ProductCategoryResyncStatusPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [jobId, setJobId] = useState('');
  const [error, setError] = useState('');
  const [statusData, setStatusData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialJobId = params.get('jobId') || '';
    if (initialJobId) {
      setJobId(initialJobId);
    }
  }, []);

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
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.errors?.error || payload?.message || 'Request failed.');
      }
      return payload;
    },
    [token]
  );

  const fetchStatus = useCallback(async () => {
    const nextJobId = String(jobId || '').trim();
    if (!nextJobId) {
      setError('Enter a job ID.');
      return;
    }
    setRefreshing(true);
    setError('');
    try {
      const data = await apiFetch(`/api/products/resync-categories/job/${encodeURIComponent(nextJobId)}`, {
        method: 'GET',
      });
      setStatusData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch job status.');
    } finally {
      setRefreshing(false);
    }
  }, [apiFetch, jobId]);

  const normalizedStatus = String(statusData?.status || statusData?.job?.status || '').toLowerCase();
  const isRunning = normalizedStatus === 'queued' || normalizedStatus === 'active';

  useEffect(() => {
    if (!String(jobId || '').trim() || !isRunning) return undefined;
    const timer = window.setInterval(() => {
      fetchStatus();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [fetchStatus, isRunning, jobId]);

  if (!isValid) {
    return <div className="screen-center">Loading...</div>;
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
                <div className="card-header">
                  <h4 className="card-title mb-0">Product Category Resync Status</h4>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  <div className="d-flex flex-wrap mb-3" style={{ gap: '8px' }}>
                    <input
                      className="form-control"
                      style={{ maxWidth: '420px' }}
                      value={jobId}
                      onChange={(e) => setJobId(e.target.value)}
                      placeholder="Enter job ID"
                    />
                    <button className="btn btn-primary btn-sm" type="button" onClick={fetchStatus} disabled={refreshing}>
                      {refreshing ? 'Refreshing...' : 'Refresh Status'}
                    </button>
                  </div>

                  {statusData ? (
                    <div className="table-responsive">
                      <table className="table table-bordered mb-0">
                        <tbody>
                          <tr><th style={{ width: '220px' }}>Job ID</th><td>{jobId || '-'}</td></tr>
                          <tr><th>Status</th><td>{statusData?.status || statusData?.job?.status || '-'}</td></tr>
                          <tr><th>Progress</th><td>{statusData?.progress ?? statusData?.job?.progress ?? '-'}</td></tr>
                          <tr><th>Processed</th><td>{statusData?.result?.processed ?? statusData?.summary?.processed ?? '-'}</td></tr>
                          <tr><th>Updated</th><td>{statusData?.result?.updated ?? statusData?.summary?.updated ?? '-'}</td></tr>
                          <tr><th>Skipped</th><td>{statusData?.result?.skipped ?? statusData?.summary?.skipped ?? '-'}</td></tr>
                          <tr><th>Failed</th><td>{statusData?.result?.failed ?? statusData?.summary?.failed ?? '-'}</td></tr>
                        </tbody>
                      </table>
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
