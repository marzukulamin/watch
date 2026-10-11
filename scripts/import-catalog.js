import fs from 'node:fs/promises';
import { db, transaction, close } from '../server/db.js';
const source = JSON.parse(
  await fs.readFile(new URL('../database/catalog-source.json', import.meta.url), 'utf8'),
);
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .trim();
const stamp = source.fetched_at;
await transaction(async (t) => {
  if (await t.get('SELECT id FROM products LIMIT 1')) {
    console.log('Catalogue already imported; refusing to overwrite live inventory or prices.');
    return;
  }
  await t.run(
    'INSERT INTO business_details(id,name,email,phone,complaint_phone,source_url,source_checked_at) VALUES(1,?,?,?,?,?,?)',
    [
      'VERSE',
      'hello@versebd.com',
      '+8801805051224',
      '+8801400542008',
      'https://versebd.com/pages/contact',
      stamp,
    ],
  );
  const locs = [
    [
      'Bailey Road',
      'Shop 36 (2nd floor), Capital Siraj Centre, Bailey Road, Dhaka 1219',
      '+8801805051226',
    ],
    [
      'Dhanmondi',
      'Shop 2079 (2nd floor), Shimanto Shambhar, Dhanmondi, Dhaka 1205',
      '+8801805051225',
    ],
  ];
  for (const l of locs)
    await t.run('INSERT INTO locations(name,address,phone,source_url) VALUES(?,?,?,?)', [
      ...l,
      'https://versebd.com/pages/contact',
    ]);
  for (const p of source.products) {
    const specs = [...p.body_html.matchAll(/<p[^>]*>\s*<strong[^>]*>(.*?)<\/strong>\s*<\/p>/gs)]
      .map((m) => decode(m[1]))
      .filter((s) => s.includes(':'))
      .map((s) => {
        const at = s.indexOf(':');
        return [s.slice(0, at).trim(), s.slice(at + 1).trim()];
      });
    const spec = (n) => specs.find(([k]) => k.toLowerCase() === n.toLowerCase())?.[1];
    const brand = (
      spec('Brand') ||
      p.title.match(/^(Emporio Armani|Timex|Casio|Fossil|Seiko|Orient)\b/i)?.[1] ||
      p.vendor
    ).trim();
    let b = await t.get('SELECT id FROM brands WHERE name=?', [brand]);
    if (!b) b = { id: (await t.run('INSERT INTO brands(name) VALUES(?)', [brand])).id };
    const model =
      spec('Model') ||
      p.title
        .split('|')
        .at(-1)
        .trim()
        .replace(new RegExp('^' + brand + '\\s+', 'i'), '');
    const collection = spec('Collection') || p.title.split(' ').slice(1, 3).join(' ');
    const gender = /unisex/i.test(p.title) ? 'unisex' : /women/i.test(p.title) ? 'women' : 'men';
    const paragraphs = [...p.body_html.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].map((m) => decode(m[1]));
    // Import factual first paragraph, remove unsupported superlatives and retailer price claims.
    const description = (paragraphs.find((s) => s.length > 100) || p.title)
      .replace(/Available at VERSEBD[^.]*\.?/gi, '')
      .replace(/\bprecision\b/gi, '')
      .trim();
    const featured = /AR11682|TWEG26803|AR11746|AQ-230A-2A1/.test(model) ? 1 : 0;
    const result = await t.run(
      'INSERT INTO products(source_id,slug,brand_id,name,full_name,model,description,gender,category,price_minor,source_available,source_url,source_checked_at,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        String(p.id),
        p.handle,
        b.id,
        collection,
        p.title,
        model,
        description,
        gender,
        /chronograph/i.test(p.title)
          ? 'chronograph'
          : /analog-digital/i.test(p.title)
            ? 'digital'
            : 'dress',
        Math.round(Number(p.variants[0].price) * 100),
        p.variants[0].available ? 1 : 0,
        `https://versebd.com/products/${p.handle}`,
        stamp,
        featured,
      ],
    );
    for (const [label, value] of specs)
      await t.run('INSERT INTO product_specs(product_id,label,value) VALUES(?,?,?)', [
        result.id,
        label,
        value,
      ]);
    for (const [position, img] of p.local_images.entries())
      await t.run(
        'INSERT INTO product_images(product_id,path,alt,source_url,position) VALUES(?,?,?,?,?)',
        [result.id, img.path, p.title.split('|')[0].trim(), img.source_url, position],
      );
  }
  const shipping = 'https://versebd.com/policies/shipping-policy';
  await t.run(
    'INSERT INTO shipping_zones(name,fee_minor,free_over_minor,cod_limit_minor,delivery_note,advance_required,source_url) VALUES(?,?,?,?,?,?,?)',
    [
      'Inside Dhaka',
      7000,
      500000,
      10000000,
      'Up to 5 working days after confirmation',
      0,
      shipping,
    ],
  );
  await t.run(
    'INSERT INTO shipping_zones(name,fee_minor,free_over_minor,cod_limit_minor,delivery_note,advance_required,source_url) VALUES(?,?,?,?,?,?,?)',
    [
      'Outside Dhaka',
      13000,
      500000,
      10000000,
      'Up to 10 working days after confirmation',
      1,
      shipping,
    ],
  );
  const content = {
    hero: {
      eyebrow: 'THE VERSE COLLECTION',
      title: 'A different\nsense of time.',
      description:
        'For the moments that become you. Discover watches with character, from everyday icons to your next signature piece.',
      cta: 'Find your timepiece',
      secondary: 'Explore the details',
      featured_model: 'AR11682',
    },
    collection: {
      eyebrow: 'THE EDIT',
      title: 'Find your\nown rhythm.',
      description: 'Different expressions. One personal choice.',
    },
    story: {
      eyebrow: 'MORE THAN THE HOUR',
      title: 'Some things\nare worth\ntaking time for.',
      description:
        'The texture of a dial. The weight on your wrist. That feeling when a watch is unmistakably you.',
      cta: 'Discover the collection',
      video: '/media/verse-detail-film.mp4',
    },
    visit: {
      eyebrow: 'OFFLINE, IN PERSON',
      title: 'Let’s make\ntime.',
      description:
        'Visit VERSE in Dhaka. Try your favourites on, take a closer look, and find the one that feels right.',
    },
  };
  for (const [section, data] of Object.entries(content))
    await t.run('INSERT INTO site_content(section,content_json) VALUES(?,?)', [
      section,
      JSON.stringify(data),
    ]);
  const policies = [
    [
      'privacy',
      'Privacy policy',
      'published',
      null,
      [
        [
          'The information we need',
          'We collect your name, email and password when you create an account. For delivery we collect the recipient’s name, phone, address, city and optional postal code. Passwords are stored as salted hashes. We do not request your birthday, gender, identity documents or card details.',
        ],
        [
          'How it is used',
          'Account information supports sign-in and order history. Delivery details support order fulfilment and customer service. Authorised administrators can access business records. Courier details are entered manually by staff; this website does not load courier, payment or marketing SDKs.',
        ],
        [
          'Optional measurement',
          'First-party page counters run only if you choose analytics. They contain the calendar day, route category and a total count. They do not contain your name, email, IP address, device fingerprint or browsing history. You can withdraw analytics consent at any time using Cookie settings.',
        ],
        [
          'Storage and your choices',
          'Session records expire after seven days. Cookie preferences are kept in your browser for up to 180 days. verse_bag in sessionStorage preserves product IDs, quantities and a checkout retry key across refreshes in this tab; it ends with the tab session and contains no account or payment details. Contact hello@versebd.com for access, correction or deletion requests. Order and finance records may need to remain for accounting obligations; retention periods must be confirmed by the business before launch.',
        ],
        [
          'Contact',
          'VERSE · hello@versebd.com · +8801805051224. Shop details are on the Stores page.',
        ],
      ],
    ],
    [
      'cookies',
      'Cookie policy',
      'published',
      null,
      [
        [
          'Essential session cookie',
          'verse_session is an HttpOnly, SameSite=Lax cookie that supports sign-in, request security and your analytics choice. It expires after seven days. Secure is enabled on HTTPS deployments.',
        ],
        [
          'Preference storage',
          'verse_preferences in localStorage remembers your cookie choice for 180 days. verse_bag in sessionStorage keeps product IDs, quantities and a checkout retry key in this tab across refreshes. It ends when the tab session closes, contains no account or payment details, and is not used for analytics. If browser storage is unavailable, the bag stays in memory until reload. No advertising cookies are used.',
        ],
        [
          'Optional analytics',
          'With permission, this website increments an aggregate first-party route counter. No analytics vendors or cross-site trackers are loaded. Rejecting analytics does not affect shopping.',
        ],
        [
          'Change your mind',
          'Open Cookie settings in the footer to change or withdraw your choice. Both acceptance and rejection are available with equal prominence.',
        ],
      ],
    ],
    [
      'terms',
      'Terms of service',
      'draft',
      'https://versebd.com/policies/terms-of-service',
      [
        [
          'Ordering',
          'Prices are in Bangladeshi taka. Your bag shows the product price; checkout calculates the delivery fee from your selected zone. An order is a request until VERSE confirms inventory, delivery and any manual payment requirements.',
        ],
        [
          'Product information',
          'Product names, descriptions and specifications are imported from VERSE’s published catalogue. Product photographs remain the source photographs. Stock quantities must be verified by staff before ordering becomes available.',
        ],
        [
          'Delivery and payment',
          'Delivery charges and estimates appear before submission. Cash on delivery and manually confirmed transfer are supported; this website never collects card or mobile banking credentials. A manual transfer instruction is not a payment receipt.',
        ],
        [
          'Warranty and returns',
          'Consult your product’s documented warranty and the Refund policy before ordering. The source terms and refund page contain different return conditions; VERSE must confirm a consistent policy before checkout is enabled.',
        ],
        [
          'Business operator',
          'The trading brand is VERSE. The registered operator, registration number and registered address must be entered by the business before live checkout is enabled.',
        ],
        [
          'Policy status',
          'This implementation draft is awaiting business approval. Source: VERSE’s existing terms page.',
        ],
      ],
    ],
    [
      'refund',
      'Refund & cancellation policy',
      'draft',
      'https://versebd.com/policies/refund-policy',
      [
        [
          'When something is wrong',
          'If an item is damaged, incorrect or cannot be delivered, contact VERSE with your order reference and a description of the issue. You can submit a refund request from your account.',
        ],
        [
          'Cancellation',
          'You may request cancellation before shipment. Your account shows the current order status and whether cancellation is available.',
        ],
        [
          'Refund review',
          'Staff review requests and record their decision. Approved refunds are recorded only after staff enter the actual refunded amount and transaction reference. No automatic refund or payment processing is claimed.',
        ],
        [
          'Fees and timing',
          'VERSE must confirm delivery-fee refunds, change-of-mind returns, eligibility and processing times before publishing this policy. The source terms and refund page conflict, so this draft does not invent a promise.',
        ],
        ['Support', 'Email hello@versebd.com or call +8801400542008 with your order reference.'],
        [
          'Policy status',
          'Awaiting business approval. Existing source policy is linked below for reference.',
        ],
      ],
    ],
    [
      'delivery',
      'Delivery information',
      'published',
      shipping,
      [
        [
          'Delivery fees',
          'Inside Dhaka: ৳70. Outside Dhaka: ৳130. Orders above ৳5,000 qualify for free delivery, based on the published shipping page. The final fee is shown before you place your order.',
        ],
        [
          'Estimated delivery',
          'Inside Dhaka: up to 5 working days. Outside Dhaka: up to 10 working days. These are published estimates and are not guaranteed arrival dates.',
        ],
        [
          'Payment arrangements',
          'The source shipping policy requires advance delivery charges outside Dhaka and excludes COD above ৳100,000. Staff must confirm manual transfers before dispatch. This website does not send SMS or collect banking credentials.',
        ],
      ],
    ],
  ];
  for (const [slug, title, status, url, sections] of policies) {
    if (['privacy', 'cookies'].includes(slug))
      sections.push([
        'Cinematic introduction',
          'verse_intro_seen in sessionStorage remembers that the optional introduction has already played in this browser tab. It contains only the presentation version watch-outlet-v2, is not sent to the server, and ends when the tab session closes. It is used only for this presentation preference, never analytics or profiling.',
      ]);
    await t.run(
      'INSERT INTO policies(slug,title,sections_json,version,source_url,status,updated_at) VALUES(?,?,?,?,?,?,?)',
      [
        slug,
        title,
        JSON.stringify(sections.map(([heading, body]) => ({ heading, body }))),
        ['privacy', 'cookies'].includes(slug) ? '2026-10-11.1' : '2026-10-09.3',
        url,
        status,
        stamp,
      ],
    );
  }
  console.log(
    `Imported ${source.products.length} source-backed products. No stock, users, orders, reviews or finance records fabricated.`,
  );
});
await close();
