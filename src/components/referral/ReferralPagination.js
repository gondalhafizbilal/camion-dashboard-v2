'use client';

export default function ReferralPagination({ pageNumber, setPageNumber, loading }) {
  return (
    <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
      <button
        className="btn btn-light btn-sm"
        type="button"
        disabled={pageNumber <= 1 || loading}
        onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
      >
        Previous
      </button>
      <button className="btn btn-outline-secondary btn-sm" type="button" disabled>
        Page {pageNumber}
      </button>
      <button className="btn btn-light btn-sm" type="button" disabled={loading} onClick={() => setPageNumber((prev) => prev + 1)}>
        Next
      </button>
    </div>
  );
}
