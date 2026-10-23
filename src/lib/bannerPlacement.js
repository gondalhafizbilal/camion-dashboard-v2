export const BANNER_PLACEMENTS = [
  'homepage',
  'Hotdeals_Web',
  'Hotdeals_Mobile',
  'all-categories',
  'all-categories-mobile',
  'single-category',
];

export function normalizeBannerPlacement(value) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();

  if (normalized === 'home') return 'homepage';
  if (normalized === 'hotdeals_web' || normalized === 'hotdeals web' || normalized === 'hot_deals_web') return 'Hotdeals_Web';
  if (normalized === 'hotdeals_mobile' || normalized === 'hotdeals mobile' || normalized === 'hot_deals_mobile') return 'Hotdeals_Mobile';
  if (normalized === 'all-categories' || normalized === 'all categories' || normalized === 'all_categories') return 'all-categories';
  if (
    normalized === 'all-categories-mobile' ||
    normalized === 'all categories mobile' ||
    normalized === 'all_categories_mobile' ||
    normalized === 'all-categories mobile'
  ) {
    return 'all-categories-mobile';
  }
  if (normalized === 'single-category' || normalized === 'single category' || normalized === 'single_category') return 'single-category';
  if (normalized === 'homepage') return 'homepage';

  return BANNER_PLACEMENTS.includes(raw) ? raw : '';
}

export function getBannerPlacementLabel(value) {
  const normalized = normalizeBannerPlacement(value);
  if (normalized === 'Hotdeals_Web') return 'Hotdeals_Web';
  if (normalized === 'Hotdeals_Mobile') return 'Hotdeals_Mobile';
  if (normalized === 'all-categories') return 'All Categories';
  if (normalized === 'all-categories-mobile') return 'All Categories / Mobile';
  if (normalized === 'single-category') return 'Single Category';
  if (normalized === 'homepage') return 'Homepage';
  return '-';
}
