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
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function toList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function PostsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [filters, setFilters] = useState({
    query: '',
    sort: 'latest',
    pageNumber: 1,
    itemsPerPage: 20,
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
        const backendError = payload?.errors?.error || payload?.errors?.name || payload?.message || 'Request failed.';
        throw new Error(Array.isArray(backendError) ? backendError.join('; ') : backendError);
      }

      return payload;
    },
    [token]
  );

  const loadPosts = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/posts', { method: 'GET' });
      setPosts(toList(data));
    } catch (err) {
      setError(err.message || 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const processedPosts = useMemo(() => {
    let next = [...posts];

    if (filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      next = next.filter((post) => {
        const title = post?.title || '';
        const slug = post?.slug || '';
        const brief = post?.brief || '';
        return title.toLowerCase().includes(q) || slug.toLowerCase().includes(q) || brief.toLowerCase().includes(q);
      });
    }

    if (filters.sort === 'title_asc') {
      next.sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || '')));
    } else if (filters.sort === 'title_desc') {
      next.sort((a, b) => String(b?.title || '').localeCompare(String(a?.title || '')));
    }

    return next;
  }, [filters.query, filters.sort, posts]);

  const startIndex = (filters.pageNumber - 1) * filters.itemsPerPage;
  const pagedPosts = processedPosts.slice(startIndex, startIndex + filters.itemsPerPage);

  const onDeletePost = async () => {
    if (!selectedPost?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');

    try {
      await apiFetch(`/api/posts/${selectedPost.uuid}`, { method: 'DELETE' });
      setMessage('Post deleted.');
      setShowDeleteModal(false);
      setSelectedPost(null);
      await loadPosts();
    } catch (err) {
      setError(err.message || 'Failed to delete post.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading posts...</div>;
  }

  return (
    <>
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
                    <h4 className="card-title mb-0">Post Management</h4>
                    <Link href="/posts/create" className="btn btn-primary btn-sm">
                      Create Post
                    </Link>
                  </div>
                  <div className="card-body">
                    {error ? <div className="alert alert-danger">{error}</div> : null}
                    {message ? <div className="alert alert-success">{message}</div> : null}

                    <div className="d-flex flex-wrap justify-content-end align-items-center mb-3" style={{ gap: '8px' }}>
                      <input
                        className="form-control form-control-sm"
                        style={{ width: '260px' }}
                        placeholder="Search title, slug, brief"
                        value={filters.query}
                        onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value, pageNumber: 1 }))}
                      />
                      <select
                        className="form-control form-control-sm"
                        style={{ width: '170px' }}
                        value={filters.sort}
                        onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value, pageNumber: 1 }))}
                      >
                        <option value="latest">Latest</option>
                        <option value="title_asc">Title (A-Z)</option>
                        <option value="title_desc">Title (Z-A)</option>
                      </select>
                      <select
                        className="form-control form-control-sm"
                        style={{ width: '120px' }}
                        value={filters.itemsPerPage}
                        onChange={(e) => setFilters((prev) => ({ ...prev, itemsPerPage: Number(e.target.value), pageNumber: 1 }))}
                      >
                        <option value={10}>10 / page</option>
                        <option value={20}>20 / page</option>
                        <option value={50}>50 / page</option>
                      </select>
                      <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadPosts}>
                        Refresh
                      </button>
                    </div>

                    {loading ? <p className="mb-0">Loading posts...</p> : null}
                    {!loading && pagedPosts.length === 0 ? <p className="mb-0">No posts found.</p> : null}

                    {!loading && pagedPosts.length > 0 ? (
                      <>
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Slug</th>
                                <th>Enabled</th>
                                <th>Created By</th>
                                <th style={{ minWidth: '220px' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedPosts.map((post) => (
                                <tr key={post.uuid}>
                                  <td>{post.title || '-'}</td>
                                  <td>{post.slug || '-'}</td>
                                  <td>{post.enabled ? 'Yes' : 'No'}</td>
                                  <td>{post?.createdBy?.fullName || post?.author?.name || '-'}</td>
                                  <td>
                                    <div className="d-flex" style={{ gap: '8px' }}>
                                      <Link href={`/posts/${post.uuid}`} className="btn btn-sm btn-outline-dark">
                                        View
                                      </Link>
                                      <Link href={`/posts/${post.uuid}/edit`} className="btn btn-sm btn-info">
                                        Edit
                                      </Link>
                                      <button
                                        className="btn btn-sm btn-danger"
                                        type="button"
                                        onClick={() => {
                                          setSelectedPost(post);
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

                        <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={filters.pageNumber <= 1 || loading}
                            onClick={() => setFilters((prev) => ({ ...prev, pageNumber: prev.pageNumber - 1 }))}
                          >
                            Previous
                          </button>
                          <button
                            className="btn btn-light btn-sm"
                            type="button"
                            disabled={startIndex + filters.itemsPerPage >= processedPosts.length || loading}
                            onClick={() => setFilters((prev) => ({ ...prev, pageNumber: prev.pageNumber + 1 }))}
                          >
                            Next
                          </button>
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
      </div>

      {showDeleteModal ? (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Delete Post</h5>
                  <button type="button" className="close" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete post <strong>{selectedPost?.title || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-light" type="button" onClick={() => setShowDeleteModal(false)} disabled={deleteLoading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeletePost} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      ) : null}
    </>
  );
}
