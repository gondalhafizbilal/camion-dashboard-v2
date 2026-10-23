'use client';

import Link from 'next/link';
import { formatDate, formatDateTime } from '@/lib/dateTime';

function getCampaignName(item) {
  return item?.nameEn || item?.name?.en || item?.slug || '-';
}

function getCampaignBrief(item) {
  return item?.briefEn || item?.brief?.en || '-';
}

function getCampaignCategories(item) {
  const categories = Array.isArray(item?.campaignCategories)
    ? item.campaignCategories.map((entry) => entry?.category?.nameEn || entry?.category?.name || entry?.category?.slug).filter(Boolean)
    : [];
  return categories.length > 0 ? categories : ['-'];
}

export default function CampaignsSection({ campaigns, loading, error, onRefresh, onDeleteCampaign, onUpdateUrgency }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: '8px' }}>
        <h4 className="mb-0">Campaign Management</h4>
        <Link href="/campaigns/new" className="btn btn-primary btn-sm">
          Create Campaign
        </Link>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="d-flex justify-content-end mb-3">
        <button className="btn btn-outline-primary btn-sm" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? <p className="mb-0">Loading campaigns...</p> : null}
      {!loading && campaigns.length === 0 ? <p className="mb-0">No campaigns found.</p> : null}

      {!loading && campaigns.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Brief</th>
                <th>Pricing Factor</th>
                <th>Discount %</th>
                <th>Starts</th>
                <th>Finishes</th>
                <th>Featured</th>
                <th>Active</th>
                <th>Categories</th>
                <th style={{ minWidth: '180px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((item) => (
                <tr key={item.uuid}>
                  <td>
                    <div>{getCampaignName(item)}</div>
                    <small className="text-muted">{item.nameAr || '-'}</small>
                  </td>
                  <td>{item.slug || '-'}</td>
                  <td>
                    <div>{getCampaignBrief(item)}</div>
                    <small className="text-muted">{item.briefAr || '-'}</small>
                  </td>
                  <td>{item.pricingFactor ?? '-'}</td>
                  <td>{item.discountPercentage ?? '-'}</td>
                  <td>{formatDate(item.startsAt)}</td>
                  <td>{formatDate(item.finishesAt)}</td>
                  <td>{item.isFeatured ? 'Yes' : 'No'}</td>
                  <td>{item.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="d-flex flex-wrap" style={{ gap: '6px' }}>
                      {getCampaignCategories(item).map((label, index) => (
                        <span key={`${item.uuid}-${label}-${index}`} className="badge badge-light" style={{ fontSize: '12px' }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="d-flex" style={{ gap: '8px', flexWrap: 'wrap' }}>
                      <Link className="btn btn-info btn-xs" href={`/campaigns/${item.uuid}`}>
                        View
                      </Link>
                      <Link className="btn btn-outline-primary btn-xs" href={`/campaigns/${item.uuid}/edit`}>
                        Edit
                      </Link>
                      <button className="btn btn-outline-danger btn-xs" type="button" onClick={() => onUpdateUrgency(item)}>
                        Urgency
                      </button>
                      <button className="btn btn-outline-dark btn-xs" type="button" onClick={() => onDeleteCampaign(item.uuid)}>
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
    </>
  );
}
