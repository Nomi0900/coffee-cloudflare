# Coffee bar website + admin panel (Cloudflare version, free hosting)

Folders:
- public/      the website, brand.js (re-brand file), videos, and the admin panel (public/admin)
- functions/   the small server code (Cloudflare Pages Functions)
- lib/         the shared backend code (api.js) and defaults.js (made automatically on every deploy)
- scripts/     build.js (runs on every deploy)

Cloudflare Pages settings:
- Framework preset: None
- Build command:    node scripts/build.js
- Build output dir: public
- D1 binding:       variable name DB  ->  your D1 database
- Variables:        ADMIN_PASSWORD (required), SESSION_SECRET (long random text)
- Optional alerts:  WHATSAPP_PHONE + CALLMEBOT_KEY (WhatsApp), NOTIFY_EMAIL + RESEND_API_KEY (+ EMAIL_FROM) (email)
- Optional:         SHOP_TZ (default Asia/Karachi)

Re-brand a new client: edit public/brand.js and replace public/videos. Menu, prices, hours, delivery and payment are changed in the admin panel (/admin).
