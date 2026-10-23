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

export default function ProcurementResyncJobStatusPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [responseData, setResponseData] = useState(null);

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

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || payload?.error || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const onCheckStatus = useCallback(
    async (event) => {
      event.preventDefault();
      const normalizedJobId = String(jobId || '').trim();
      if (!normalizedJobId) {
        setError('Job ID is required.');
        return;
      }

      setLoading(true);
      setError('');
      setMessage('');
      setResponseData(null);
      try {
        const payload = await apiFetch(`/api/procurement/resync-variants/job/${encodeURIComponent(normalizedJobId)}`, {
          method: 'GET',
        });
        setResponseData(payload || null);
        setMessage('Job status fetched successfully.');
      } catch (err) {
        setError(err.message || 'Failed to fetch job status.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, jobId]
  );

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
                  <h4 className="card-title mb-0">Procurement Resync Job Status</h4>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <form onSubmit={onCheckStatus} className="mb-4">
                    <div className="row">
                      <div className="col-md-8 mb-2">
                        <label className="form-label">Job ID</label>
                        <input
                          className="form-control"
                          placeholder="Enter resync job ID"
                          value={jobId}
                          onChange={(e) => setJobId(e.target.value)}
                        />
                      </div>
                      <div className="col-md-4 mb-2 d-flex align-items-end justify-content-end">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          {loading ? 'Checking...' : 'Get Status'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {responseData ? (
                    <>
                      <div className="table-responsive mb-3">
                        <table className="table table-bordered mb-0">
                          <tbody>
                            <tr>
                              <th style={{ width: '220px' }}>Job ID</th>
                              <td>{responseData?.jobId || '-'}</td>
                            </tr>
                            <tr>
                              <th>Status</th>
                              <td>{responseData?.status || '-'}</td>
                            </tr>
                            <tr>
                              <th>Scope</th>
                              <td>{responseData?.scope || '-'}</td>
                            </tr>
                            <tr>
                              <th>Products Count</th>
                              <td>{responseData?.productsCount ?? '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div>
                        <label className="form-label">Raw Response</label>
                        <pre
                          className="form-control"
                          style={{ whiteSpace: 'pre-wrap', minHeight: '220px', maxHeight: '480px', overflow: 'auto' }}
                        >
                          {JSON.stringify(responseData, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted mb-0">Enter a job ID to fetch resync status.</p>
                  )}
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

