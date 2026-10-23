'use client';

import Link from 'next/link';
import { formatDateTime } from '@/lib/dateTime';

function formatCategory(category) {
  if (!category) return '-';
  const name = category?.nameEn || category?.slug || '-';
  return (
    <>
      <div>{name}</div>
      <small className="text-muted">{category?.uuid || '-'}</small>
    </>
  );
}

function formatStatus(status) {
  const key = String(status || '').toLowerCase();
  return key || '-';
}

function formatFormat(format) {
  return String(format || '-');
}

export default function ExportRequestsSection({
  loading,
  requests,
  pageNumber,
  setPageNumber,
  itemsPerPage,
  setItemsPerPage,
  onRefresh,
  onDeleteRequest,
  onOpenStatusModal,
  deleteLoadingUuid,
}) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: '8px' }}>
        <h4 className="mb-0">Export Requests</h4>
        <Link href="/export-requests/new" className="btn btn-primary btn-sm">
          Create Export Request
        </Link>
      </div>

      <div className="d-flex justify-content-end mb-3" style={{ gap: '8px' }}>
        <select className="form-control" style={{ width: '140px' }} value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button className="btn btn-outline-primary btn-sm" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>Name</th>
              <th>Format</th>
              <th>Pages</th>
              <th>Category</th>
              <th>Download URL</th>
              <th>Status</th>
              <th>Created</th>
              <th style={{ width: '280px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((item) => (
              <tr key={item.uuid}>
                <td>{item.name || '-'}</td>
                <td>{formatFormat(item.format)}</td>
                <td>{item.pagesCount ?? '-'}</td>
                <td>{formatCategory(item.category)}</td>
                <td style={{ maxWidth: '260px' }}>
                  {item.downloadUrl ? (
                    <span className="text-truncate d-inline-block" style={{ maxWidth: '250px' }}>
                      {item.downloadUrl}
                    </span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td>
                  <span className="badge badge-light">{formatStatus(item.status)}</span>
                </td>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>
                  <div className="d-flex flex-wrap" style={{ gap: '8px' }}>
                    <Link className="btn btn-info btn-xs" href={`/export-requests/${item.uuid}`}>
                      View
                    </Link>
                    <Link className="btn btn-outline-primary btn-xs" href={`/export-requests/${item.uuid}/edit`}>
                      Edit
                    </Link>
                    <button className="btn btn-outline-warning btn-xs" type="button" onClick={() => onOpenStatusModal(item)}>
                      Update Status
                    </button>
                    <button className="btn btn-outline-dark btn-xs" type="button" onClick={() => onDeleteRequest(item.uuid)} disabled={deleteLoadingUuid === item.uuid}>
                      {deleteLoadingUuid === item.uuid ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && requests.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted">
                  No export requests found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="d-flex justify-content-end mt-3" style={{ gap: '8px' }}>
        <button className="btn btn-light btn-sm" type="button" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber(pageNumber - 1)}>
          Previous
        </button>
        <button className="btn btn-light btn-sm" type="button" disabled>
          Page {pageNumber}
        </button>
        <button
          className="btn btn-light btn-sm"
          type="button"
          disabled={loading || requests.length < itemsPerPage}
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
