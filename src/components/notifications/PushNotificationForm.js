'use client';

const PRIORITY_OPTIONS = ['low', 'medium', 'high'];
const SCHEDULE_OPTIONS = ['', 'every_30_min', 'every_3', 'every_6', 'every_12', 'every_24'];
const SCHEDULE_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'fixed', label: 'Fixed' },
];

function getScheduleLabel(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'Not Scheduled';
  if (normalized === 'every_30_min') return 'Every 30 Minutes';
  if (normalized === 'every_3') return 'Every 3 Hours';
  if (normalized === 'every_6') return 'Every 6 Hours';
  if (normalized === 'every_12') return 'Every 12 Hours';
  if (normalized === 'every_24') return 'Every 24 Hours';
  return normalized;
}

function renderFieldError(fieldErrors, key) {
  return fieldErrors?.[key] || '';
}

export function getNotificationImage(notification) {
  if (notification?.imageUrl) return notification.imageUrl;
  if (Array.isArray(notification?.images) && notification.images.length > 0) {
    return notification.images[0]?.thumbnailUrl || notification.images[0]?.imageUrl || '';
  }
  return '';
}

export default function PushNotificationForm({
  title,
  backHref,
  submitLabel,
  submitting,
  error,
  success,
  fieldErrors,
  formData,
  onChange,
  onSubmit,
  imageFile,
  onImageChange,
  existingImageUrl = '',
}) {
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h4 className="card-title mb-0">{title}</h4>
        <a href={backHref} className="btn btn-outline-primary btn-sm">
          Back
        </a>
      </div>
      <div className="card-body">
        {error ? <div className="alert alert-danger">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}

        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Title</label>
              <input
                className={`form-control${renderFieldError(fieldErrors, 'title') ? ' is-invalid' : ''}`}
                name="title"
                value={formData.title}
                onChange={onChange}
                maxLength={100}
                required
              />
              {renderFieldError(fieldErrors, 'title') ? (
                <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'title')}</div>
              ) : null}
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">Priority</label>
              <select
                className={`form-control${renderFieldError(fieldErrors, 'priority') ? ' is-invalid' : ''}`}
                name="priority"
                value={formData.priority}
                onChange={onChange}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {renderFieldError(fieldErrors, 'priority') ? (
                <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'priority')}</div>
              ) : null}
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">Schedule Type</label>
              <select className="form-control" name="scheduleType" value={formData.scheduleType} onChange={onChange}>
                {SCHEDULE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || 'none'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.scheduleType === 'recurring' ? (
              <div className="col-md-6 mb-3">
                <label className="form-label">Scheduled For</label>
                <select
                  className={`form-control${renderFieldError(fieldErrors, 'scheduledFor') ? ' is-invalid' : ''}`}
                  name="scheduledFor"
                  value={formData.scheduledFor}
                  onChange={onChange}
                >
                  {SCHEDULE_OPTIONS.map((option) => (
                    <option key={option || 'none'} value={option}>
                      {getScheduleLabel(option)}
                    </option>
                  ))}
                </select>
                {renderFieldError(fieldErrors, 'scheduledFor') ? (
                  <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'scheduledFor')}</div>
                ) : null}
              </div>
            ) : null}

            {formData.scheduleType === 'fixed' ? (
              <div className="col-md-6 mb-3">
                <label className="form-label">Scheduled At</label>
                <input
                  type="datetime-local"
                  className={`form-control${renderFieldError(fieldErrors, 'scheduledAt') ? ' is-invalid' : ''}`}
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={onChange}
                />
                <small className="text-muted d-block mt-1">One-time schedule. Uses date and time.</small>
                {renderFieldError(fieldErrors, 'scheduledAt') ? (
                  <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'scheduledAt')}</div>
                ) : null}
              </div>
            ) : null}

            <div className="col-md-6 mb-3">
              <label className="form-label">Brief</label>
              <input
                className={`form-control${renderFieldError(fieldErrors, 'brief') ? ' is-invalid' : ''}`}
                name="brief"
                value={formData.brief}
                onChange={onChange}
                maxLength={160}
                required
              />
              {renderFieldError(fieldErrors, 'brief') ? (
                <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'brief')}</div>
              ) : null}
            </div>

            <div className="col-md-12 mb-3">
              <label className="form-label">Message</label>
              <textarea
                className={`form-control${renderFieldError(fieldErrors, 'message') ? ' is-invalid' : ''}`}
                name="message"
                rows={5}
                value={formData.message}
                onChange={onChange}
                required
              />
              {renderFieldError(fieldErrors, 'message') ? (
                <div className="text-danger small mt-1">{renderFieldError(fieldErrors, 'message')}</div>
              ) : null}
            </div>

            <div className="col-md-12 mb-3">
              <label className="form-label">Image</label>
              <input className="form-control" type="file" accept="image/*" onChange={onImageChange} />
              <small className="text-muted d-block mt-1">Optional. The image is uploaded after the notification is saved.</small>
              {imageFile ? <small className="text-muted d-block mt-1">Selected: {imageFile.name}</small> : null}
              {!imageFile && existingImageUrl ? (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingImageUrl}
                    alt="Notification"
                    style={{ width: '180px', maxWidth: '100%', borderRadius: '10px', border: '1px solid #eee' }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="d-flex" style={{ gap: '8px' }}>
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : submitLabel}
            </button>
            <a href={backHref} className="btn btn-light">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
