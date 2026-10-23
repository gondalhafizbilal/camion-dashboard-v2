'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getTransformedImageUrl } from '@/lib/imageUrl';

function formatProductLabel(product) {
  const title = product?.titleEn || product?.titleAr || product?.slug || 'Unnamed product';
  return `${title}${product?.uuid ? ` (${product.uuid})` : ''}`;
}

export default function ProductAjaxSearchSelect({
  apiFetch,
  selectedProductUuid,
  selectedProduct,
  onSelectProduct,
  label = 'Product',
  hideSearch = false,
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState('');

  const loadProductByUuid = useCallback(async () => {
    if (!selectedProductUuid || selectedProduct || !apiFetch) return;
    try {
      const data = await apiFetch(`/api/products/${encodeURIComponent(selectedProductUuid)}`, { method: 'GET' });
      if (data?.uuid) {
        onSelectProduct(data);
      }
    } catch {
      // Keep the control usable even if the selected product cannot be reloaded.
    }
  }, [apiFetch, onSelectProduct, selectedProduct, selectedProductUuid]);

  const searchProducts = useCallback(
    async (nextQuery) => {
      if (!apiFetch) return;
      const trimmed = String(nextQuery || '').trim();

      if (trimmed.length < 2) {
        setResults([]);
        setSearchError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setSearchError('');
      try {
        const params = new URLSearchParams();
        params.set('pageNumber', '1');
        params.set('itemsPerPage', '20');
        params.set('filters', JSON.stringify({ query: trimmed }));
        const data = await apiFetch(`/api/products?${params.toString()}`, { method: 'GET' });
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        setSearchError(err.message || 'Failed to search products.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    loadProductByUuid();
  }, [loadProductByUuid]);

  useEffect(() => {
    const trimmed = String(query || '').trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError('');
      setLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      searchProducts(trimmed);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, searchProducts]);

  const selectedImageUrl = useMemo(() => {
    return selectedProduct?.featuredThumbnailUrl || selectedProduct?.featuredImageUrl || '';
  }, [selectedProduct]);

  return (
    <div>
      {!hideSearch ? (
        <>
          <label className="form-label">{label}</label>
          <input
            className="form-control"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type at least 2 characters to search product"
          />
          <small className="text-muted d-block mt-1">Live search starts after 2 characters.</small>
          {searchError ? <div className="text-danger small mt-2">{searchError}</div> : null}

          {loading ? <div className="small text-muted mt-2">Searching products...</div> : null}

          {!loading && results.length > 0 ? (
            <div className="border rounded bg-white mt-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
              {results.map((product) => (
                <button
                  key={product.uuid}
                  type="button"
                  className="btn btn-link text-left w-100"
                  style={{
                    padding: '10px 12px',
                    textDecoration: 'none',
                    borderBottom: '1px solid #f1f1f1',
                    color: '#222',
                  }}
                  onClick={() => {
                    onSelectProduct(product);
                    setQuery(product.titleEn || product.slug || '');
                    setResults([]);
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{product.titleEn || product.slug || '-'}</div>
                  <div className="small text-muted">{product.uuid}</div>
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {selectedProduct ? (
        <div className="card bg-light border-0 mt-3" style={{ borderRadius: '16px' }}>
          <div className="card-body">
            <div className="row align-items-center">
              <div className="col-md-12">
                <div style={{ fontWeight: 600 }}>{selectedProduct.titleEn || selectedProduct.slug || '-'}</div>
                <div className="small text-muted">{selectedProduct.titleAr || '-'}</div>
                <div className="small mt-1">{formatProductLabel(selectedProduct)}</div>
                {!hideSearch ? (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mt-2"
                    onClick={() => {
                      onSelectProduct(null);
                      setQuery('');
                      setResults([]);
                    }}
                  >
                    Clear selection
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
