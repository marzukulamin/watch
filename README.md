# VERSE

A self-hosted watch storefront and business application in **E:/Websites/Watch**. Three.js powers a dimensional product-photography stage; Anime.js powers page entrances, animated lettering and section motion. Public business content and catalogue records are read through a database API. No fake reviews, stock counts, customers, order history, sales, scarcity timers or authentication credentials are seeded.

## Run locally

Requires Node.js 24 or newer. Dependencies are installed and locked in package-lock.json.

```powershell
cd E:\Websites\Watch
npm run db:init
npm run db:import
npm run build
npm start
```

Open http://127.0.0.1:3000. `npm run dev` uses Vite development middleware; production uses only the built files. The default SQLite database makes the local application usable without inventing a MySQL installation. It is **not managed by phpMyAdmin**. The production MySQL adapter and schema are supplied below. No automatic fallback is used when a configured MySQL connection fails.

The shopping bag survives refreshes in the same browser tab using session storage. It stores product IDs, quantities and the checkout retry key, with an in-memory fallback when storage is unavailable. For existing databases, run `node scripts/update-bag-policy.js` once to update the storage disclosures; fresh catalogue imports include them.

The schema contains source-backed business/store details, brands, products/specifications/images, warehouses, inventory/movements, customers/admins, sessions, delivery zones, versioned policies, order/address snapshots, order items, status history, shipments, payments, refund requests/refunds, expenses, consent, aggregate analytics and an admin audit log. Money is integer paisa; order prices/costs/policy versions are snapshotted. Fulfilment reserves stock, dispatch deducts it, and cancellation releases it transactionally.

## MySQL and phpMyAdmin

phpMyAdmin is a management application, not the database itself. No MySQL, PHP or Docker installation was available in this session, so phpMyAdmin has not been started. Use your existing local MySQL/phpMyAdmin installation, or install Docker using your normal method and use the supplied compose file.

1. Copy `.env.example` to `.env`. Set unique `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`. Keep `.env` private and out of Git.
2. For Docker, run `docker compose up -d`. MySQL binds to 127.0.0.1:3306; phpMyAdmin binds to 127.0.0.1:8081. Neither is publicly exposed.
3. Open phpMyAdmin and sign in to the `mysql` server using your own credentials. Select the `verse` database. Import **database/mysql-schema.sql** once into an empty database. Alternatively, `DB_DRIVER=mysql npm run db:init` initializes it through the application driver.
4. Set `DB_DRIVER=mysql`, the real connection settings and `APP_ORIGIN` in `.env`.
5. Run `npm run db:import` to import the factual catalogue into MySQL. It refuses to overwrite existing catalogue data. It does not copy local test/customer activity.
6. Create your admin, then restart the server. SQLite and MySQL are separate databases; a switch does not silently migrate operational records.

The generated MySQL schema uses InnoDB, utf8mb4, explicit foreign keys, checks and indexes. Target MySQL 8.0+ (compose uses 8.4) or MariaDB 10.6+. It was generated and statically checked; it could not be executed against MySQL in this session.

## Create the real admin

There are exactly two roles: **admin** and **customer**. Customers can register on `/account`. An admin cannot be created by the public registration endpoint. Create the real business admin from the local terminal:

```powershell
$env:ADMIN_EMAIL = 'your-real-admin-email'
$env:ADMIN_NAME = 'your-real-name'
$securePassword = Read-Host 'Choose a unique admin password (12+ characters)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $securePassword).Password
npm run admin:create
Remove-Item Env:ADMIN_PASSWORD
```

Sign in at `/account`, then open `/admin`. No default login is provided. Admins can inspect every operational business table in the UI; password hashes and session secrets are excluded. phpMyAdmin provides full database management for an authorised database administrator.

The dashboard includes catalogue edits, warehouses and verified stock/cost entries, order confirmation/packing/dispatch/tracking/delivery, actual payment receipts, expenses, refund review/payment records, policy editing, legal business details, financial summaries and consented aggregate page counts. No courier/payment/SMS APIs are connected; staff enter actual carrier, tracking and transaction references.

## Live-checkout readiness

Catalogue prices, product photographs/specifications, store contacts and delivery fees were imported from Verse's public site on 9 October 2026. Every product/image retains a source URL. See database/catalog-source.json and docs/reference.

Before accepting orders, the real business must:

- Enter its registered operator, registration number, registered address and explicitly confirmed tax treatment/rate in the admin.
- Confirm and publish consistent terms and refund policies, with a new version. The existing Verse terms and refund pages conflict on returns, so both implementation drafts remain unpublished.
- Add actual warehouses and verify physical inventory. Public catalogue availability does not establish warehouse quantity.
- Confirm current prices/specifications, tax treatment, courier procedures, published delivery terms, refund conditions, privacy-retention requirements and all required business disclosures.

Until the first three requirements are met, the server refuses checkout. The public catalogue/bag remain usable and customer care is available. No order or payment is presented as completed without a corresponding database record. Policy drafts are explicitly labelled on their pages.

COD supports eligible delivery zones and totals. Delivery thresholds use product values before tax, as specified by the published source. Manually confirmed transfer supports orders requiring advance payment; the app never collects card or banking credentials. Staff must record the required actual receipts before dispatch. No online payment collection is claimed. Cancellation does not fabricate a refund. Refund amounts cannot exceed recorded unrefunded payments.

## Privacy and security

The app collects only account identity and fulfilment information needed for the current flows. It does not request birthdays, identity documents, demographics or card details. No newsletter subscription is inferred from an account/order. Essential HttpOnly session cookies expire after seven days; SameSite=Lax is used, and Secure must be enabled for HTTPS deployments. Passwords are salted scrypt hashes. State changes use a CSRF token and origin validation, authorization is server-side, inputs are bounded, SQL values use prepared statements, and order/inventory/finance mutations use transactions.

Cookie acceptance and rejection have equal presentation. Optional analytics are first-party aggregate route/day counters, not user-level tracking. Revoking consent stops recording future views. Preference expiry is 180 days. No Meta Pixel, Google Analytics, Shopify runtime, Google Fonts runtime, chat widgets, payment SDKs or ad trackers are loaded. Source HTML is stored only under docs and is not shipped as a runtime page. CSP blocks external runtime resources.

Deploy the app behind HTTPS, set `SECURE_COOKIES=true`, `APP_ORIGIN=https://your-domain`, and explicitly configure `HOST` for the reverse proxy. Restrict MySQL/phpMyAdmin to trusted local access, use least-privilege database users, and establish encrypted backups, recovery exercises, log/record retention and staff access procedures before launch. Policy implementation is not a certification of legal compliance.

## Asset and motion details

Product imagery is compressed locally to WebP. Fonts, JavaScript and media are bundled locally. The Three.js stage uses actual source photography, not a claim of an exact manufactured 3D model. The background film is an eight-second silent movement study of a product wrist photograph; provenance is recorded in docs/reference/detail-film-provenance.json. No reference montage footage is used in the storefront.

`npm run assets:fetch` re-fetches and compresses the curated source imagery (network needed during authoring only). `node scripts/render-detail-film.js` re-creates the optional local background loop using ffmpeg. Source images remain available in the gallery. No paid services or hosted runtime dependencies are required.

## Verification

```powershell
npm test
npx playwright test
npm run build
npm audit
```

The commerce tests use an isolated in-memory database; invented fixtures never enter the storefront database. Browser tests check desktop and mobile flows, actual source-backed products, optional consent, reduced motion, role access and the absence of external runtime requests. The browser config uses installed local Chrome; change its executable path if your system differs. Tests write screenshots under docs/reference. See docs/AUDIT.md for outcomes and remaining launch requirements.
# Cinematic entrance and Google Cloud

The homepage has a local Gemini Omni Flash intro: official logo on black, watch assembly from the right, frontal rotation and zoom, boutique construction, opening doors and exact VERSE reveal. Anime.js dissolves into the hero. Pause, skip and footer replay are available; reduced-motion/data-saving preferences bypass it. The watch and outlet are disclosed cinematic concepts. The tab-local preference is disclosed in database-backed privacy/cookie pages.

Google Cloud Omni is connected for development asset preparation through the existing gcloud login, project `jerserio-project`, global endpoint, model `gemini-omni-1.1-flash-preview`. The website makes no visitor-facing Cloud calls. See [Cloud connection and costs](docs/GOOGLE-CLOUD.md) and [cinematic implementation report](docs/INTRO-REPORT.md).

The active film uses reviewed generated shots, a focused Omni edit, local dial cleanup and exact source branding. Compressed desktop/mobile files are local. Preview/export: `public/media/intro/verse-full-intro.v2.mp4` (19.5 seconds, silent 1080p). Raw media and inspection evidence remain in `docs/reference`; the earlier rejected manufacturer-branded film is not served.


### Guided demo workflow

Visitors can select **Test a user workflow** on any page, or open `/workflow.html`, then choose **Test customer workflow** or **Test admin workflow**. The tour animates a visible cursor over the product choice, sample checkout, customer account, admin dashboard and updated customer timeline. Visitors can pause, replay, or take over the controls.

This is a browser sandbox, separate from the production commerce backend. It creates no real users, orders, payments, stock changes or courier requests. Session storage keeps progress across reloads in the same tab; a new tab starts a fresh session. Reset demo data clears sample orders. If storage is unavailable, the tour works in memory until reload. All quantities, availability, delivery fees and fulfilment are simulated.

Tour assets live in `public/workflow*`. Watch includes them in `dist` during `npm run build`; Demo serves them in both the Node site and static Netlify demo. Browser verification for both folders: run `node scripts/qa-workflow.mjs` from Demo (requires local Chrome).
