'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { getTransformedImageUrl } from '@/lib/imageUrl';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function flattenCategories(categories, parentName = null) {
  if (!Array.isArray(categories)) return [];

  const rows = [];
  categories.forEach((category) => {
    const currentName = category?.nameEn || category?.name || null;
    rows.push({ ...category, parentName });
    if (Array.isArray(category.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, currentName));
    }
  });

  return rows;
}

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function CategoriesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [titleCaseUpdating, setTitleCaseUpdating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

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
  const rows = useMemo(() => flattenCategories(categories), [categories]);

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
        const backendError = payload?.errors?.error || payload?.errors?.slug || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const loadCategories = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/api/categories', { method: 'GET' });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  const productListHref = (category) => {
    const slug = String(category?.slug || '').trim();
    return slug ? `/products?categorySlug=${encodeURIComponent(slug)}` : '/products';
  };

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const onDeleteCategory = async () => {
    if (!selectedCategory?.uuid) return;
    setDeleteLoading(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/categories/${selectedCategory.uuid}`, { method: 'DELETE' });
      setMessage('Category deleted.');
      setShowDeleteModal(false);
      setSelectedCategory(null);
      await loadCategories();
    } catch (err) {
      setError(err.message || 'Failed to delete category.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const onTitleCaseAllNames = async () => {
    if (rows.length === 0) return;

    setTitleCaseUpdating(true);
    setError('');
    setMessage('');
    try {
      let updated = 0;
      for (const category of rows) {
        const currentEn = String(category?.nameEn || category?.name || '').trim();
        const nextEn = toTitleCase(currentEn);
        if (!currentEn || currentEn === nextEn) continue;

        await apiFetch(`/api/categories/${category.uuid}`, {
          method: 'PUT',
          body: JSON.stringify({
            slug: category.slug || '',
            name: {
              en: nextEn,
              ar: String(category?.nameAr || '').trim(),
            },
            pricingFactor: Number(category?.pricingFactor || 0),
            discountPercentage: Number(category?.discountPercentage || 0),
            isFeatured: Boolean(category?.isFeatured),
            isFeaturedOnHomepage: Boolean(category?.isFeaturedOnHomepage),
          }),
        });
        updated += 1;
      }

      await loadCategories();
      setMessage(updated > 0 ? `Updated ${updated} category name(s) to Title Case.` : 'All category EN names are already Title Case.');
    } catch (err) {
      setError(err.message || 'Failed to update category names.');
    } finally {
      setTitleCaseUpdating(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading categories...</div>;
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
                  <h4 className="card-title mb-0">Category Management</h4>
                  <Link href="/categories/create" className="btn btn-primary btn-sm">
                    Create Category
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}
                  {message ? <div className="alert alert-success">{message}</div> : null}

                  <div className="d-flex justify-content-end mb-3" style={{ gap: '8px' }}>
                    <button
                      className="btn btn-outline-dark btn-sm d-none"
                      type="button"
                      onClick={onTitleCaseAllNames}
                      disabled={loading || titleCaseUpdating || rows.length === 0}
                    >
                      {titleCaseUpdating ? 'Updating...' : 'Title Case All EN Names'}
                    </button>
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={loadCategories}>
                      Refresh
                    </button>
                  </div>

                  {loading ? <p className="mb-0">Loading categories...</p> : null}
                  {!loading && rows.length === 0 ? <p className="mb-0">No categories found.</p> : null}

                  {!loading && rows.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Products</th>
                            <th>Pricing Factor</th>
                            <th>Discount %</th>
                            <th>Featured</th>
                            <th>Homepage Featured</th>
                            <th>Parent Name</th>
                            <th style={{ minWidth: '220px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((category) => (
                            <tr key={category.uuid}>
                              <td>
                                {category.thumbnailUrl ? (
                                  <img
                                    src={getTransformedImageUrl(category.thumbnailUrl)}
                                    alt={category.nameEn || category.name || 'Category'}
                                    style={{
                                      width: '64px',
                                      height: '64px',
                                      objectFit: 'contain',
                                      borderRadius: '6px',
                                      border: '1px solid #e6e6e6',
                                      background: '#fff',
                                      padding: '4px',
                                    }}
                                  />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td>
                                <div>{category.nameEn || category.name || '-'}</div>
                                <small className="text-muted">{category.nameAr || '-'}</small>
                              </td>
                              <td>{category.slug || '-'}</td>
                              <td>
                                {category.slug ? (
                                  <Link href={productListHref(category)} className="btn btn-sm btn-outline-dark">
                                    {category.productsCount ?? 0}
                                  </Link>
                                ) : (
                                  category.productsCount ?? 0
                                )}
                              </td>
                              <td>{category.pricingFactor ?? '-'}</td>
                              <td>{category.discountPercentage ?? '-'}</td>
                              <td>{category.isFeatured ? 'Yes' : 'No'}</td>
                              <td>{category.isFeaturedOnHomepage ? 'Yes' : 'No'}</td>
                              <td>{category.parentName || '-'}</td>
                              <td>
                                <div className="d-flex" style={{ gap: '8px' }}>
                                  <Link href={`/categories/${category.uuid}`} className="btn btn-sm btn-outline-dark">
                                    View
                                  </Link>
                                  <Link href={`/categories/${category.uuid}/edit`} className="btn btn-sm btn-info">
                                    Edit
                                  </Link>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    type="button"
                                    onClick={() => {
                                      setSelectedCategory(category);
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
                  <h5 className="modal-title">Delete Category</h5>
                  <button
                    type="button"
                    className="close"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleteLoading}
                  >
                    <span>&times;</span>
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Delete category <strong>{selectedCategory?.slug || ''}</strong>? This action cannot be undone.
                  </p>
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-light"
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-danger" type="button" onClick={onDeleteCategory} disabled={deleteLoading}>
                    {deleteLoading ? 'Deleting...' : 'Delete'}
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
