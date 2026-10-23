'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function ProductResyncAllPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [running, setRunning] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({
    totalPages: 0,
    donePages: 0,
    totalProducts: 0,
    sentProducts: 0,
    processedProducts: 0,
  });
  const [summary, setSummary] = useState({
    pagesVisited: 0,
    productsFetched: 0,
    productsSubmitted: 0,
    variantsMatched: 0,
    variantsUpdated: 0,
    variantsMissingInSource: 0,
    jobs: [],
  });
  const [form, setForm] = useState({
    fromPage: 1,
    toPage: 1,
    itemsPerPage: 50,
  });

  const cancelRef = useRef(false);
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
        const backendError =
          payload?.errors?.error ||
          payload?.message ||
          payload?.error ||
          'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const onRun = useCallback(async () => {
    const fromPage = Math.max(1, Number(form.fromPage) || 1);
    const toPage = Math.max(fromPage, Number(form.toPage) || fromPage);
    const itemsPerPage = Math.min(50, Math.max(1, Number(form.itemsPerPage) || 50));

    cancelRef.current = false;
    setCancelRequested(false);
    setRunning(true);
    setError('');
    setMessage('');
    setSummary({
      pagesVisited: 0,
      productsFetched: 0,
      productsSubmitted: 0,
      variantsMatched: 0,
      variantsUpdated: 0,
      variantsMissingInSource: 0,
      jobs: [],
    });
    setProgress({
      totalPages: toPage - fromPage + 1,
      donePages: 0,
      totalProducts: 0,
      sentProducts: 0,
      processedProducts: 0,
    });

    let pagesVisited = 0;
    let productsFetched = 0;
    let productsSubmitted = 0;
    let variantsMatched = 0;
    let variantsUpdated = 0;
    let variantsMissingInSource = 0;
    const jobs = [];

    try {
      for (let page = fromPage; page <= toPage; page += 1) {
        if (cancelRef.current) break;

        const listRes = await apiFetch(`/api/products?pageNumber=${page}&itemsPerPage=${itemsPerPage}&sort=desc`, { method: 'GET' });
        const products = Array.isArray(listRes) ? listRes : [];
        const uuids = products.map((p) => p?.uuid).filter(Boolean);

        pagesVisited += 1;
        productsFetched += products.length;

        setProgress((prev) => ({
          ...prev,
          donePages: prev.donePages + 1,
          totalProducts: productsFetched,
        }));

        if (!uuids.length) continue;

        const resyncRes = await apiFetch('/api/procurement/resync-variants', {
          method: 'POST',
          body: JSON.stringify({ productUuids: uuids.slice(0, 50) }),
        });

        productsSubmitted += uuids.slice(0, 50).length;
        variantsMatched += Number(resyncRes?.variantsMatched || 0);
        variantsUpdated += Number(resyncRes?.variantsUpdated || 0);
        variantsMissingInSource += Number(resyncRes?.variantsMissingInSource || 0);
        if (resyncRes?.jobId) jobs.push(String(resyncRes.jobId));

        setProgress((prev) => ({
          ...prev,
          sentProducts: productsSubmitted,
          processedProducts: variantsUpdated,
        }));
      }

      setSummary({
        pagesVisited,
        productsFetched,
        productsSubmitted,
        variantsMatched,
        variantsUpdated,
        variantsMissingInSource,
        jobs,
      });

      if (cancelRef.current) {
        setMessage('Resync cancelled. Partial progress is shown below.');
      } else {
        setMessage('Resync all completed successfully.');
      }
    } catch (err) {
      setError(err.message || 'Resync failed.');
    } finally {
      setRunning(false);
    }
  }, [apiFetch, form.fromPage, form.itemsPerPage, form.toPage]);

  const onCancel = useCallback(() => {
    cancelRef.current = true;
    setCancelRequested(true);
  }, []);

  const pageProgressPct = progress.totalPages > 0 ? Math.round((progress.donePages / progress.totalPages) * 100) : 0;

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
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h4 className="card-title mb-0">Products - Sync All Variants</h4>
                  <Link href="/products" className="btn btn-outline-primary btn-sm">
                    Back to Products
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="row">
                    <div className="col-md-3 mb-3">
                      <label className="form-label">From Page</label>
                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        value={form.fromPage}
                        disabled={running}
                        onChange={(e) => setForm((prev) => ({ ...prev, fromPage: Number(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">To Page</label>
                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        value={form.toPage}
                        disabled={running}
                        onChange={(e) => setForm((prev) => ({ ...prev, toPage: Number(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="col-md-3 mb-3">
                      <label className="form-label">Items Per Page (Max 50)</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        className="form-control"
                        value={form.itemsPerPage}
                        disabled={running}
                        onChange={(e) => setForm((prev) => ({ ...prev, itemsPerPage: Number(e.target.value) || 50 }))}
                      />
                    </div>
                    <div className="col-md-3 mb-3 d-flex align-items-end" style={{ gap: '8px' }}>
                      <button className="btn btn-primary btn-sm" type="button" onClick={onRun} disabled={running || !token}>
                        {running ? 'Running...' : 'Start Sync All'}
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        type="button"
                        onClick={onCancel}
                        disabled={!running || cancelRequested}
                      >
                        {cancelRequested ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <small className="text-muted">Page progress</small>
                      <small className="text-muted">{pageProgressPct}%</small>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div className="progress-bar" role="progressbar" style={{ width: `${pageProgressPct}%` }} />
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <tbody>
                        <tr>
                          <th style={{ width: '280px' }}>Pages Done</th>
                          <td>{progress.donePages} / {progress.totalPages}</td>
                        </tr>
                        <tr>
                          <th>Total Products Fetched</th>
                          <td>{progress.totalProducts}</td>
                        </tr>
                        <tr>
                          <th>Total Products Submitted</th>
                          <td>{progress.sentProducts}</td>
                        </tr>
                        <tr>
                          <th>Variants Matched</th>
                          <td>{summary.variantsMatched}</td>
                        </tr>
                        <tr>
                          <th>Variants Updated</th>
                          <td>{summary.variantsUpdated}</td>
                        </tr>
                        <tr>
                          <th>Missing In Source</th>
                          <td>{summary.variantsMissingInSource}</td>
                        </tr>
                        <tr>
                          <th>Job IDs</th>
                          <td>{summary.jobs.length ? summary.jobs.join(', ') : '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
