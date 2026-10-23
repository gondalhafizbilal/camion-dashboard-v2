'use client';

import Link from 'next/link';
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
  return (
    user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || user?.emailAddress || 'User'
  );
}

function buildPageItems(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, 2, 3, totalPages - 2, totalPages - 1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
    .flatMap((page, index, arr) => {
      const next = arr[index + 1];
      if (next && next - page > 1) {
        return [page, 'ellipsis'];
      }
      return [page];
    });
}

export default function CustomersPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchType, setSearchType] = useState('fullName');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [appliedSearchType, setAppliedSearchType] = useState('fullName');
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState('');
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countLoading, setCountLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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

  const loadCustomers = useCallback(async (nextSearchType = appliedSearchType, nextSearchKeyword = appliedSearchKeyword, nextPageNumber = pageNumber, nextItemsPerPage = itemsPerPage) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      const keyword = String(nextSearchKeyword || '').trim();
      const type = String(nextSearchType || '').trim();
      if (keyword && type) {
        params.set('filters', JSON.stringify({ [type]: keyword }));
      }

      params.set('pageNumber', String(nextPageNumber));
      params.set('itemsPerPage', String(nextItemsPerPage));

      const path = params.toString() ? `/api/customers?${params.toString()}` : '/api/customers';
      const data = await apiFetch(path, { method: 'GET' });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, appliedSearchKeyword, appliedSearchType, itemsPerPage, pageNumber, token]);

  const loadCounts = useCallback(async () => {
    if (!token) return;
    setCountLoading(true);
    try {
      const data = await apiFetch('/api/data/counts', { method: 'GET' });
      setTotalCustomers(Number(data?.customers || 0));
    } catch (err) {
      setError(err.message || 'Failed to load customer counts.');
      setTotalCustomers(0);
    } finally {
      setCountLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadCustomers();
    loadCounts();
  }, [loadCustomers, loadCounts]);

  const onApplyFilters = async (event) => {
    event.preventDefault();
    setAppliedSearchType(searchType);
    setAppliedSearchKeyword(searchKeyword);
    setPageNumber(1);
    await loadCustomers(searchType, searchKeyword, 1, itemsPerPage);
  };

  const onResetFilters = async () => {
    setSearchType('fullName');
    setSearchKeyword('');
    setAppliedSearchType('fullName');
    setAppliedSearchKeyword('');
    setPageNumber(1);
    await loadCustomers('fullName', '', 1, itemsPerPage);
  };

  const totalPages = Math.max(1, Math.ceil(totalCustomers / itemsPerPage));
  const pageItems = buildPageItems(totalPages, pageNumber);

  const onGoToPage = async (nextPage) => {
    const page = Math.min(Math.max(1, nextPage), totalPages);
    setPageNumber(page);
    await loadCustomers(appliedSearchType, appliedSearchKeyword, page, itemsPerPage);
  };

  const onDeleteCustomer = async () => {
    if (!selectedCustomer?.uuid) return;

    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/customers/${selectedCustomer.uuid}`, { method: 'DELETE' });
      setMessage('Customer deleted.');
      setShowDeleteModal(false);
      setSelectedCustomer(null);
      await loadCounts();
      await loadCustomers();
    } catch (err) {
      setError(err.message || 'Failed to delete customer.');
    } finally {
      setDeleting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading customers...</div>;
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
                  <h4 className="card-title mb-0">Customer Management</h4>
                  <Link href="/customers/create" className="btn btn-primary btn-sm">
                    Create Customer
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <form onSubmit={onApplyFilters} className="mb-3">
                    <div className="row">
                      <div className="col-md-4 mb-2">
                        <label className="form-label">Search By</label>
                        <select
                          className="form-control"
                          value={searchType}
                          onChange={(e) => setSearchType(e.target.value)}
                        >
                          <option value="fullName">Name</option>
                          <option value="emailAddress">Email</option>
                          <option value="phoneNumber">Phone Number</option>
                        </select>
                      </div>
                      <div className="col-md-8 mb-2">
                        <label className="form-label">Keyword</label>
                        <input
                          className="form-control"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          placeholder="Enter search keyword"
                        />
                      </div>
                    </div>
                    <div className="d-flex justify-content-end" style={{ gap: '8px' }}>
                      <button className="btn btn-light btn-sm" type="button" onClick={onResetFilters} disabled={loading}>
                        Reset
                      </button>
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={() => loadCustomers(appliedSearchType, appliedSearchKeyword, pageNumber, itemsPerPage)} disabled={loading}>
                        Refresh
                      </button>
                      <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
                        Apply
                      </button>
                    </div>
                  </form>

                  {loading ? <p className="mb-0">Loading customers...</p> : null}
                  {!loading && customers.length === 0 ? <p className="mb-0">No customers found.</p> : null}

                  {!loading && customers.length > 0 ? (
                    <>
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>Full Name</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th>Orders</th>
                              <th style={{ minWidth: '220px' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customers.map((customer) => (
                              <tr key={customer.uuid}>
                                <td>
                                  <div>{customer.fullName || '-'}</div>
                                  <small className="text-muted">{customer.uuid || '-'}</small>
                                </td>
                                <td>{customer.emailAddress || '-'}</td>
                                <td>{customer.phoneNumber || '-'}</td>
                                <td>{customer.ordersCount ?? 0}</td>
                                <td>
                                  <div className="d-flex" style={{ gap: '8px' }}>
                                    <Link href={`/customers/${customer.uuid}`} className="btn btn-sm btn-outline-dark">
                                      View
                                    </Link>
                                    <Link href={`/orders?customerUuid=${encodeURIComponent(customer.uuid)}`} className="btn btn-sm btn-outline-primary">
                                      View Orders ({customer.ordersCount ?? 0})
                                    </Link>
                                    <Link href={`/customers/${customer.uuid}/edit`} className="btn btn-sm btn-info">
                                      Edit
                                    </Link>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      type="button"
                                      onClick={() => {
                                        setSelectedCustomer(customer);
                                        setShowDeleteModal(true);
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap" style={{ gap: '8px' }}>
                        <small className="text-muted">
                          {countLoading ? 'Loading total customers...' : `Total Customers: ${totalCustomers}`}
                        </small>
                        <div className="d-flex flex-wrap align-items-center" style={{ gap: '8px' }}>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={pageNumber <= 1 || loading}
                            onClick={() => onGoToPage(pageNumber - 1)}
                          >
                            Prev
                          </button>
                          {pageItems.map((item, index) =>
                            item === 'ellipsis' ? (
                              <button key={`ellipsis-${index}`} className="btn btn-outline-secondary btn-sm" type="button" disabled>
                                ...
                              </button>
                            ) : (
                              <button
                                key={item}
                                className={`btn btn-sm ${item === pageNumber ? 'btn-primary' : 'btn-outline-secondary'}`}
                                type="button"
                                disabled={loading}
                                onClick={() => onGoToPage(item)}
                              >
                                {item}
                              </button>
                            )
                          )}
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={pageNumber >= totalPages || loading}
                            onClick={() => onGoToPage(pageNumber + 1)}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Customer</h5>
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete customer <strong>{selectedCustomer?.fullName || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteCustomer} disabled={deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </div>
  );
}
