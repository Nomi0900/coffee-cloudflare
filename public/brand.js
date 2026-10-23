/* =====================================================================
   BRAND CONFIG: change this one file to re-brand the whole website.
   Rules: keep the quotes, keep the commas, do not delete the { } [ ].
   You can use <em>word</em> inside titles to make a word gold and italic.
   After editing, save the file (or upload it to GitHub) and refresh.
   ===================================================================== */
window.BRAND = {

  /* ---- 1. Identity ---- */
  name: 'ONYX Coffee Bar',                 // full shop name (browser tab, emails, alerts)
  logoText: 'ONYX',                        // big word in the logo and the opening screen
  tagline: 'Specialty coffee bar',         // small line under the big opening word
  city: 'Karachi',
  title: 'ONYX Coffee Bar — Specialty coffee in Karachi',      // browser tab + Google title
  description: 'ONYX Coffee Bar in Karachi: small-batch specialty coffee, poured by hand. Order for pickup or delivery.',
  siteUrl: 'https://example.com',          // your REAL website address (needed for the share image below)
  ogImage: '',                             // share image shown when the link is sent on WhatsApp, 1200x630. Put the file in public/images and write /images/share.jpg

  /* ---- 2. Colours ---- */
  colors: {
    bg: '#0A0806',        // page background
    bg2: '#120E0A',       // cards background
    accent: '#D4A24C',    // main accent (gold)
    accent2: '#F0C878',   // lighter accent used in buttons
    text: '#F4EEE4',      // main text
    muted: '#A89B8A'      // soft text
  },

  /* ---- 3. Fonts (from fonts.google.com) ----
     Use the Google Fonts "embed" link for url, and the exact font names below. */
  fonts: {
    url: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap',
    headline: 'Newsreader',
    body: 'Figtree'
  },

  /* ---- 4. Menu bar and small labels ---- */
  nav: { journey: 'Journey', menu: 'Menu', shop: 'Shop', visit: 'Visit', order: 'Order now' },
  scrollHint: 'Scroll the journey',

  /* ---- 5. The scrolling video journey ----
     src    = video file (put it in the videos folder). Leave '' to show an animated placeholder.
     still  = a picture instead of a video (used for the last scene)
     poster = picture shown while the video loads
     c      = two background colours behind the scene
     btn    = 1 puts the "Order now" button on that scene
     Add or remove scenes freely (2 to 6 scenes work well). */
  scenes: [
    { src: 'videos/scene1.mp4', poster: 'videos/scene1.jpg', k: 'Chapter 01', h: 'Every cup begins with a bean.', p: 'Single-origin, roasted in small batches every week.', c: ['#0c1a19', '#050b0a'] },
    { src: 'videos/scene2.mp4', poster: 'videos/scene2.jpg', k: 'Chapter 02', h: 'Poured with patience.', p: 'Slow, steady and fresh, right to the last drop.', c: ['#0c1a19', '#050b0a'] },
    { src: '', still: 'videos/scene3.jpg', btn: 1, k: 'Chapter 03', h: 'Taste the difference.', p: 'Order online for pickup or delivery.', c: ['#0c1a19', '#050b0a'] }
  ],

  /* ---- 6. Moving word strip ---- */
  marquee: ['Small batch', 'Slow poured', 'Roasted fresh', 'Made at the bar', 'Order ahead'],

  /* ---- 7. Section texts ---- */
  menu: { title: 'Signature <em>pours</em>', sub: 'Six drinks we are known for, made to order at the bar.' },
  shop: {
    title: 'Shop by <em>category</em>', sub: 'Beans, blends and brewing gear, roasted and packed in small batches.',
    /* Four tiles. label = text. filter = the Filter group (set in the admin panel) the tile opens.
       icon = beans, glass, dripper or box (a drawing). image = optional photo, for example /images/cat-beans.jpg (replaces the drawing). */
    tiles: [
      { label: 'Whole beans', filter: 'Beans', icon: 'beans', image: '' },
      { label: 'Cold brew', filter: 'Bottled', icon: 'glass', image: '' },
      { label: 'Brewing gear', filter: 'Gear', icon: 'dripper', image: '' },
      { label: 'Subscriptions', filter: 'Plans', icon: 'box', image: '' }
    ],
    bestTitle: 'Best <em>sellers</em>', bestSub: 'The bags and cups our regulars reorder every week.'
  },
  story: {
    title: 'Small batches. <em>Slow mornings.</em>',
    p1: 'We started ONYX to make one thing well: a cup you slow down for. Beans come from three small farms and are roasted here every week. Replace this with your own story.',
    p2: 'Every pour is weighed and timed, and every order is made fresh at the bar.',
    stats: [['Every Monday', 'Fresh roast day'], ['3 farms', 'Direct partners'], ['Till midnight', 'Open late']]
  },
  reviews: { title: 'What guests <em>say</em>', sub: '' },
  visit: { title: 'Visit <em>us</em>', directions: 'Get directions', whatsapp: 'Order on WhatsApp' },
  final: { title: 'Your cup is <em>waiting.</em>', button: 'Order now' },
  footer: '© 2026 ONYX Coffee Bar',

  /* ---- 8. First-start defaults for the admin panel ----
     Used ONLY the first time the server starts with an empty database.
     After that, change these things inside the admin panel instead. */
  defaults: {
    settings: {
      address: 'Add your street address, Karachi', phone: '+92 300 0000000', whatsapp: '920000000000',
      hours: 'Mon – Fri|8 am – 11 pm\nSaturday|9 am – 12 am\nSunday|10 am – 11 pm',
      instagram: 'https://instagram.com/yourshop', tiktok: 'https://tiktok.com/@yourshop', currency: 'Rs',
      pickupEnabled: true, deliveryEnabled: true, deliveryFee: 150, freeDeliveryOver: 2500, minOrder: 0,
      deliveryNote: 'We deliver within the city. Tell us your full address.',
      metaPixelId: '', currencyCode: 'PKR',
      onlineEnabled: false, payInstructions: 'Send the payment to: [Easypaisa / JazzCash / bank account details]. Then type the transaction ID below.'
    },
    products: [
      { name: 'Flat white', grp: 'Hot', desc: 'Double ristretto, silky milk', price: 520, category: 'drink', tag: 'Signature' },
      { name: 'Iced spanish latte', grp: 'Cold', desc: 'Condensed milk, cold espresso', price: 640, category: 'drink', tag: 'Signature' },
      { name: 'V60 pour-over', grp: 'Hot', desc: "Bright, clean, this week's origin", price: 580, category: 'drink', tag: 'Signature' },
      { name: 'Cold brew', grp: 'Cold', desc: 'Steeped 18 hours, never bitter', price: 560, category: 'drink', tag: 'Signature' },
      { name: 'Cardamom mocha', grp: 'Hot', desc: 'Dark chocolate and warm spice', price: 680, category: 'drink', tag: 'Signature' },
      { name: 'Affogato', grp: 'Dessert', desc: 'Espresso poured over vanilla', price: 620, category: 'drink', tag: 'Signature' },
      { name: 'Single-origin beans', grp: 'Beans', desc: '250g whole bean', price: 1800, category: 'product', tag: '250g · Whole bean' },
      { name: 'House espresso blend', grp: 'Beans', desc: '250g ground', price: 1600, category: 'product', tag: '250g · Ground' },
      { name: 'Midnight cold brew', grp: 'Bottled', desc: '1 litre bottle', price: 1250, category: 'product', tag: '1 litre · Bottled' },
      { name: 'Pour-over starter kit', grp: 'Gear', desc: 'V60 dripper and filters', price: 4500, category: 'product', tag: 'Kit · V60' },
      { name: 'Bean subscription', grp: 'Plans', desc: 'Fresh bag every month', price: 1500, category: 'product', tag: 'Monthly plan' },
      { name: 'Onyx tasting cup', grp: 'Gear', desc: 'Ceramic, 200ml', price: 900, category: 'product', tag: 'Ceramic · 200ml' }
    ]
  }
};
