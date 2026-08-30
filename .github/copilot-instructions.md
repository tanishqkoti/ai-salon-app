# GlowBook / AI Salon & Spa Platform — Copilot Instructions

## Project purpose

This repository is an AI-powered salon and spa web platform for both men and women.

The product has three user areas:

1. Customer platform:
   - Discover salons
   - Browse salon pages, services, stylists, portfolios, and beauty inspiration
   - Select a service, preferred stylist, date, and time
   - Create, reschedule, cancel, and view appointments
   - Save hairstyle inspiration
   - Use loyalty points and rewards
   - Receive email, browser push, and in-app notifications
   - Use AI hairstyle recommendations and hairstyle try-on later

2. Salon business dashboard:
   - Manage bookings
   - Manage customers and service history
   - Track preferred stylists
   - Manage staff, availability, leave, and services
   - Manage loyalty programs, rewards, VIP customers, and campaigns
   - View analytics and revenue
   - Manage salon profile, images, settings, and policies

3. Platform admin dashboard:
   - Onboard salons
   - Manage subscriptions/plans
   - Review salon listings and user reports
   - Monitor platform analytics
   - Manage marketplace listings and featured placements later

The platform must not depend on WhatsApp. Use website booking, email, browser push notifications, in-app notifications, and optional SMS later.

## Current repository structure

- `frontend/` is the Next.js application.
- `backend/` is a FastAPI/Python backend managed separately.
- Do not delete, rename, overwrite, or break existing backend code.
- Do not place frontend code in `backend/`.
- Do not place Python/FastAPI code in `frontend/`.
- Before editing, inspect existing files and preserve working code.

## Current frontend stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- React
- npm
- Frontend route files belong in `frontend/src/app/`
- Shared frontend components belong in `frontend/src/components/`
- Shared frontend types belong in `frontend/src/types/`
- Shared frontend helpers/API clients belong in `frontend/src/lib/`

## Existing working frontend routes

These routes may already exist and must be preserved/improved, not replaced carelessly:

- `/` — customer homepage
- `/salons` — salon discovery list
- `/salons/[slug]` — salon profile/details page
- `/book/[salonId]` — multi-step booking UI
- `/salon/dashboard` — salon owner overview dashboard
- `/salon/customers` — customer database and customer profile UI
- `/salon/staff` — staff and availability UI
- `/salon/services` — services and pricing UI
- `/salon/loyalty` — loyalty and VIP UI

## Product design requirements

- Build a premium, modern, warm, aesthetic beauty-tech interface.
- Use a soft luxury palette:
  - Background: `#fff9fb`
  - Primary dark: `#2b1b25`
  - Primary pink: `#d84b87`
  - Soft pink: `#fff0f6`
  - Main muted text: `#6d5863`
  - Border: `#f0dce5`
- Mobile-first responsive design.
- Customer pages should feel elegant and visual.
- Salon owner dashboard should be professional, readable, fast, and practical.
- Use accessible semantic HTML.
- Use visible labels for inputs.
- Buttons must have clear loading, disabled, success, and error states when connected to real APIs.
- Do not use WhatsApp buttons, WhatsApp API, WhatsApp notifications, or WhatsApp chatbot features.
- Avoid fake “AI-powered” claims. Clearly label AI features as previews or recommendations when added.

## Technical rules

- Use TypeScript strictly. Do not use `any` unless absolutely unavoidable.
- Prefer reusable components and typed data models.
- Use `Link` from `next/link` for internal navigation.
- Use Next.js App Router conventions:
  - `page.tsx` for routes
  - `loading.tsx` for loading UI where useful
  - `error.tsx` for route error UI where useful
  - `not-found.tsx` where useful
- Client components must include `"use client"` only when they need React state, effects, or browser APIs.
- Keep server components as server components whenever possible.
- Do not store secrets, API keys, service-account JSON, payment secrets, or private URLs in frontend code.
- Use `.env.local` for frontend public configuration only, such as:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Never expose backend-only keys using `NEXT_PUBLIC_`.
- Do not make destructive database, file, or repository changes without asking for confirmation.
- Do not delete existing files just because a new implementation is cleaner. Prefer safe edits and new files.

## API integration rules

The backend is FastAPI/Python and may use Firebase/Firestore.

When API integration begins:

- Centralize API calls in `frontend/src/lib/api/`.
- Create typed interfaces for all request and response data.
- Read API base URL from `NEXT_PUBLIC_API_BASE_URL`.
- Handle loading, empty, error, and success states.
- Do not silently ignore failed API calls.
- Keep mock data only behind a clear development fallback, never mixed invisibly with production data.
- Use user-friendly error messages.
- Do not implement real payment, notification, or AI API calls until environment variables and backend endpoints are available.

## Booking rules

The booking flow must eventually support:

1. Customer selects salon.
2. Customer selects service.
3. Customer selects a qualified stylist or “Any available stylist.”
4. Customer selects date and time.
5. System checks stylist working hours, leave, breaks, service duration, buffers, and conflicting bookings.
6. Customer submits contact details.
7. Appointment is created as pending or confirmed according to salon policy.
8. Salon can approve, reschedule, complete, mark no-show, or cancel.
9. Customer can view, reschedule, or cancel based on policy.
10. Completed appointment writes service history, points, revenue, and analytics records.

Do not trust availability checks only in the frontend. Conflict prevention must be enforced by the backend/database later.

## Privacy and safety rules

The product handles customer names, contact information, booking history, service preferences, possible allergy notes, payment data, and later customer selfies.

- Collect only data needed for the feature.
- Add clear customer consent for marketing email/push campaigns.
- Add separate explicit consent before selfie upload or AI hairstyle try-on.
- Do not retain selfie images by default after a try-on session.
- Do not train AI models on customer photos without separate explicit consent.
- Add placeholders for privacy policy, account deletion, data deletion, and consent settings.
- Never display personal data from one salon to another salon.
- Use role-based access design: customer, receptionist, stylist, manager, owner, platform admin.

## Phased roadmap

### Phase 1: Make existing frontend consistent

- Inspect current routes and resolve 404 errors.
- Add a shared responsive customer navbar and footer.
- Add a shared salon dashboard sidebar/header.
- Ensure all existing dashboard navigation links work.
- Add a clear 404/not-found page.
- Make existing mock-data pages responsive and visually consistent.
- Do not add a database yet unless specifically requested.

### Phase 2: Complete core salon dashboard UI

Create or complete these routes:

- `/salon/bookings`
- `/salon/customers`
- `/salon/staff`
- `/salon/services`
- `/salon/loyalty`
- `/salon/analytics`
- `/salon/settings`

Required dashboard capabilities at the UI/mock-data stage:

- Booking status: Pending, Confirmed, Completed, Cancelled, No-show
- Booking filtering/search by date, customer, stylist, service, and status
- Customer profiles and service history
- Preferred stylist
- VIP customer segmentation
- Loyalty points and rewards
- Staff working hours, leave, breaks, specialties, and services
- Service price, duration, active/paused state, and assigned staff
- Basic analytics cards and charts
- Salon profile/settings UI

### Phase 3: Customer experience UI

Create or complete:

- `/inspiration` — Pinterest-style hairstyle and beauty feed
- `/saved-styles` — customer saved inspiration
- `/try-on` — AI hairstyle try-on user interface only; use a safe placeholder image upload state until backend/API is ready
- `/customer/dashboard`
- `/customer/bookings`
- `/customer/profile`
- `/customer/loyalty`
- `/salons/[slug]` portfolio, services, stylists, reviews, policies, and booking entry point

Features:

- Search/filter styles by category, hair length, occasion, hair type, budget, and maintenance level
- Save/unsave styles
- Map each style to relevant salon services
- Mood-based service quiz and rule-based recommendations
- Favourite/preferred stylist
- Booking history, cancellation/reschedule UI
- Loyalty balance and rewards

### Phase 4: Connect backend safely

Only after the UI is stable and backend API routes are known:

- Connect authentication.
- Connect salons, services, staff, customers, appointments, loyalty, reviews, and notifications.
- Replace mock data incrementally.
- Add optimistic UI only where rollback/error handling exists.
- Add real loading and error states.
- Ensure one salon cannot access another salon's data.

### Phase 5: Advanced features

Only after real bookings and dashboard data work:

- Email appointment confirmation and reminders
- Browser push notifications
- Booking deposits/payments
- Waitlist and smart slot filling
- Feedback system
- AI hairstyle try-on
- AI hairstyle/service recommendations
- Salon marketplace/map discovery
- Multi-branch/franchise features
- Influencer collections
- Trend analytics using only suitable aggregated data

## Definition of done

For every task:

1. Inspect the current relevant files first.
2. State the plan briefly.
3. Make minimal safe changes.
4. Do not remove working existing routes or functionality.
5. Run `npm run lint` from `frontend/`.
6. Run `npm run build` from `frontend/` when practical.
7. Fix TypeScript and lint errors caused by your changes.
8. Report:
   - Files created
   - Files modified
   - Routes added/changed
   - Commands run and results
   - Manual test steps
   - Any feature intentionally left as mock data or needing backend work