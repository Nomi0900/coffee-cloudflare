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

## Order alerts (set these in Cloudflare: your project > Settings > Variables and Secrets)
Add only the ones you want. Use type "Secret". Then press "Deploy" so they take effect, and test with Admin > Settings > "Send a test alert".

Phone push (easiest, free, no account): install the "ntfy" app, subscribe to a long random topic name, then add
- NTFY_TOPIC      the same topic name, e.g. onyx-orders-k8x2q9m4v7   (the topic name is the password, keep it private)

Telegram (reliable, free): create a bot with @BotFather, send it a message, then add
- TELEGRAM_BOT_TOKEN   the token BotFather gives you
- TELEGRAM_CHAT_ID     your chat id (see the guide)

WhatsApp (free CallMeBot, sends to your own number; can be slow or stop working):
- WHATSAPP_PHONE       923001234567
- CALLMEBOT_KEY        key from callmebot.com

Email (Resend):
- NOTIFY_EMAIL         where alerts go
- RESEND_API_KEY       from resend.com
- EMAIL_FROM           optional. Without it, Resend's test sender is used (it only delivers to your own Resend account email)

Also: while the admin page is open, press "Turn on" in Orders for a sound and pop-up on that device. The page checks every 30 seconds.
