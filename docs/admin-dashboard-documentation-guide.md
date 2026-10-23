# Admin Dashboard Documentation (Guide Based)

## Overview

This admin dashboard is built with Next.js for the Camion platform.
It provides CRUD flows, operational tools, queue actions, review workflows, and backend integrations through internal API proxy routes.

## Tech Stack

- Next.js 1
- React
- App Router (`src/app`)
- Client-side authenticated admin pages
- Internal API proxy routes under `src/app/api`

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env.local
```

Required environment values:

- `API_URL`
- `NEXT_PUBLIC_API_URL`

Development server:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

## Project Structure

### Main folders

- `src/app`
  Application pages and API routes.
- `src/app/api`
  Internal proxy routes forwarding requests to backend services.
- `src/components`
  Shared UI sections, forms, layout components, and module-specific components.
- `src/lib`
  Utility helpers such as auth, proxy helpers, image URL helpers, and date formatting helpers.

### Common layout components

- `NavHeader`
- `Sidebar`
- `Topbar`
- `Footer`

## Authentication Flow

Most admin pages:

1. Read auth from local storage using helpers in `src/lib/auth`.
2. Validate token with `isAuthValid`.
3. Redirect to `/login` when auth is missing or expired.
4. Send backend requests with `Authorization: Bearer <token>`.

## Backend Integration Pattern

The dashboard does not usually call backend URLs directly from page components.

Instead:

1. Page component calls an internal route such as `/api/products`.
2. That route forwards the request to backend using `forwardRequest`.
3. The proxy attaches auth headers and preserves backend responses.

Main proxy helper:

- `src/lib/serverApiProxy.js`

Example:

- Page: `/exchange-rates`
- Proxy: `src/app/api/exchange-rates/route.js`
- Backend: `/v1/exchange-rates`

## Routing Model

### Primary dashboard pages

- `/dashboard`
- `/products`
- `/categories`
- `/orders`
- `/customers`
- `/users`
- `/warehouses`
- `/banners`
- `/campaigns`
- `/promos`
- `/stories`
- `/posts`
- `/currencies`
- `/languages`
- `/exchange-rates`
- `/key-value-pairs`
- `/export-requests`
- `/procurement`
- `/notifications/custom`
- `/referral`
- `/return-refund`
- `/site-settings`

### Common route patterns

- Listing page
- Create page
- View page
- Edit page

Examples:

- `/products`
- `/products/create`
- `/products/[uuid]`
- `/products/[uuid]/edit`

## Current Admin Modules

### Dashboard

Purpose:

- Summary metrics
- recent orders
- recent products
- quick operational visibility

Route:

- `/dashboard`

### Products

Purpose:

- product listing
- create/edit/view product
- variants
- options and option values
- featured image
- gallery attachments
- size chart image
- review creation access
- procurement links
- category resync entry points

Key routes:

- `/products`
- `/products/create`
- `/products/[uuid]`
- `/products/[uuid]/edit`
- `/products/reviews`
- `/products/reviews/new`

Related API areas:

- `/api/products`
- `/api/products/[uuid]`
- `/api/products/[uuid]/attachments`
- `/api/products/[uuid]/sizechart`
- `/api/products/[uuid]/reviews`

### Categories

Purpose:

- category management
- featured states
- thumbnail handling

Route:

- `/categories`

Related API:

- `/api/categories`

### Orders

Purpose:

- list and view orders
- status update
- dispatch workflows
- invalid order visibility
- customer-linked order filtering
- tracking URL visibility

Key routes:

- `/orders`
- `/orders/[uuid]`
- `/orders/dispatch-orders`
- `/orders/dispatched-orders`

Related API:

- `/api/orders`
- `/api/orders/[uuid]`
- `/api/orders/[uuid]/status`
- `/api/wms/orders`
- `/api/wms/orders/dispatch`

### Customers

Purpose:

- customer listing
- filtering
- detail and edit pages
- link through to customer-specific orders

Route:

- `/customers`

Related API:

- `/api/customers`

### Users

Purpose:

- admin and user account management
- role and status updates

Route:

- `/users`

Related API:

- `/api/users`

### Warehouses

Purpose:

- warehouse CRUD

Route:

- `/warehouses`

Related API:

- `/api/warehouses`

### Banners

Purpose:

- banner listing
- create/edit/view
- placement selection
- category assignment
- multilingual links and content fields

Route:

- `/banners`

Related API:

- `/api/banners`

### Campaigns

Purpose:

- campaign listing
- create/edit/view
- categories
- pricing factor
- scheduling fields
- featured and active state handling

Route:

- `/campaigns`

Related API:

- `/api/campaigns`

### Promos

Purpose:

- promo management

Route:

- `/promos`

Related API:

- `/api/promos`

### Stories

Purpose:

- story CRUD
- frame management
- media preview

Route:

- `/stories`

Related API:

- `/api/stories`

### Posts

Purpose:

- post CRUD

Route:

- `/posts`

Related API:

- `/api/posts`

### Currencies

Purpose:

- currency management

Route:

- `/currencies`

Related API:

- `/api/currencies`

### Languages

Purpose:

- language management

Route:

- `/languages`

Related API:

- `/api/languages`

### Exchange Rates

Purpose:

- exchange rate listing
- create/edit/view/delete
- server-side pageNumber and itemsPerPage support

Route:

- `/exchange-rates`

Related API:

- `/api/exchange-rates`

Backend note:

- current backend list supports `pageNumber` and `itemsPerPage`
- current backend returns an array, not a paginated `{ items, total }` object

### Key Value Pairs

Purpose:

- configuration values
- typed values
- sensitive flag

Route:

- `/key-value-pairs`

Related API:

- `/api/key-value-pairs`

### Export Requests

Purpose:

- create export requests
- list, inspect, and update status

Route:

- `/export-requests`

Related API:

- `/api/export-requests`

### Procurement

Purpose:

- inspect procurement product details
- create procurement orders
- bulk ordering
- variant resync
- save procurement product into catalog

Key routes:

- `/procurement`
- `/procurement/[productId]`
- `/procurement/create-order`
- `/procurement/bulk-order`
- `/procurement/resync-job-status`

Related API:

- `/api/procurement`
- `/api/procurement/[productId]`
- `/api/procurement/order`
- `/api/procurement/order/bulk`
- `/api/procurement/resync-variants`

### Notifications

Purpose:

- custom push notification listing
- create/edit/view
- image upload
- send action
- recurring and fixed scheduling
- stop scheduled notifications

Route:

- `/notifications/custom`

Related API:

- `/api/push-notifications`
- `/api/push-notifications/[uuid]`
- `/api/push-notifications/push`
- `/api/push-notifications/stop/[uuid]`

### Referral

Purpose:

- affiliates
- coupons
- global coupons
- wallets
- transactions

Routes:

- `/referral/affiliates`
- `/referral/coupons`
- `/referral/global-coupons`
- `/referral/wallets`
- `/referral/transactions`

Related API:

- `/api/referral/[...path]`

### Return & Refund

Purpose:

- admin return-request listing
- status update
- order linkage
- evidence and eligibility visibility

Route:

- `/return-refund`

Related API:

- `/api/return-requests/admin/all`
- `/api/return-requests/[uuid]`
- `/api/return-requests/[uuid]/status`

### Site Settings

Purpose:

- application-level settings interface

Route:

- `/site-settings`

## Shared Implementation Patterns

### 1. Page state

Most pages use:

- `loading`
- `error`
- `success` or `message`
- modal state for destructive actions
- pagination state where supported

### 2. Data loading

Most pages define:

- `apiFetch()` helper inside the page
- `load<Module>()` callback
- `useEffect()` to trigger initial fetch

### 3. Delete confirmation

Delete flows commonly use:

- selected item state
- modal open state
- delete loading state

### 4. Query parameter forwarding

For list pages using pagination, filtering, or sorting:

- page component builds query string
- internal API route must forward `request.nextUrl.search`

### 5. Browser-local time formatting

Timestamp display is standardized through:

- `src/lib/dateTime.js`

Available helpers:

- `formatDateTime`
- `formatDate`
- `toLocalDateTimeInputValue`

## Current Operational Notes

### Exchange rates pagination

The dashboard now supports pagination in `/exchange-rates`, but total-page count cannot be calculated because the backend currently returns a plain array without total count metadata.

### Dynamic route params

For Next.js App Router API routes, dynamic params should be unwrapped with:

```js
const { uuid } = await params;
```

This is required in Next.js 16 route handlers.

### Build note

The app currently builds successfully, but there is an unrelated SSR warning seen during static generation:

`ReferenceError: location is not defined`

This should be tracked separately.

## Recommended Documentation Expansion

This guide is the high-level reference. It can be expanded later into:

1. Setup and deployment guide
2. Module-by-module admin user manual
3. API mapping document between dashboard routes and backend endpoints
4. Contribution guide for adding new admin modules
5. Troubleshooting guide for auth, proxy, build, and SSR issues

## File Location

This document is stored at:

`admin-next/docs/admin-dashboard-documentation-guide.md`
