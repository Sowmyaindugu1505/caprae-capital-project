
'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const https = require('node:https');
const http = require('node:http');

const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10000;

// 1. Check IPv4 addresses
function isPublicIPv4(address) {
  if (net.isIP(address) !== 4) return false;

  const [a, b, c, d] = address.split('.').map(Number);

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 0 && d === 0) return false;

  return true;
}

// 2. Check IPv6 addresses
function isPublicIPv6(address) {
  if (net.isIP(address) !== 6 || address.includes('%')) {
    return false;
  }

  const ip = address.toLowerCase();

  if (ip.includes('.')) return false;

  const first = parseInt(
    ip.split(':').find(Boolean) || '0',
    16
  );

  return (
    (first & 0xe000) === 0x2000 &&
    !(first === 0x2001 && /^2001:0?db8:/i.test(ip)) &&
    !(first === 0x2001 && /^2001:0?:/i.test(ip))
  );
}

// 3. Combined IP checker
function isPublicIP(address) {
  return net.isIP(address) === 4
    ? isPublicIPv4(address)
    : isPublicIPv6(address);
}

// 4. Validate website URLs
function parseWebsiteUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) {
    throw new Error('Invalid website URL.');
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    throw new Error('Invalid website URL.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !url.hostname ||
    url.hostname.endsWith('.') ||
    !/^[a-z0-9.-]+$/i.test(url.hostname) ||
    url.hostname === 'localhost' ||
    /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname) ||
    !url.hostname.includes('.') ||
    net.isIP(url.hostname)
  ) {
    throw new Error(
      'Only public HTTP(S) website hostnames are allowed.'
    );
  }

  return url;
}

function isSafeWebsiteUrl(input) {
  try {
    parseWebsiteUrl(input);
    return true;
  } catch {
    return false;
  }
}

// 5. Check website DNS addresses
async function checkWebsiteDNS(input) {
  const url = parseWebsiteUrl(input);

  const addresses = await dns.lookup(url.hostname, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error('No IP addresses found.');
  }

  const results = addresses.map(({ address, family }) => ({
    address,
    family,
    allowed: isPublicIP(address)
  }));

  return {
    hostname: url.hostname,
    addresses: results,
    allAllowed: results.every(item => item.allowed)
  };
}

// 6. Clean HTML text
function cleanHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// 7. Extract meta description
function metaDescription(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of tags) {
    if (!/\bname\s*=\s*(["'])description\1/i.test(tag)) {
      continue;
    }

    const match = tag.match(
      /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i
    );

    if (match) {
      return cleanHtml(match[2]);
    }
  }

  return 'No description found';
}

// 8. Extract company name from structured data
function structuredName(html) {
  const blocks = [
    ...html.matchAll(
      /<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  const scan = value => {
    if (!value || typeof value !== 'object') {
      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = scan(item);
        if (result) return result;
      }

      return null;
    }

    const types = Array.isArray(value['@type'])
      ? value['@type']
      : [value['@type']];

    const organizationTypes = [
      'Organization',
      'Corporation',
      'LocalBusiness'
    ];

    if (
      types.some(type => organizationTypes.includes(type)) &&
      typeof value.name === 'string' &&
      value.name.trim()
    ) {
      return value.name.trim();
    }

    return scan(value['@graph']);
  };

  for (const block of blocks) {
    try {
      const name = scan(JSON.parse(block[1]));

      if (name) return name;
    } catch {
      // Ignore invalid structured data.
    }
  }

  return null;
}

// 9. Build company profile
function extractCompanyProfile(html, source) {
  const titleMatch = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  const pageTitle = titleMatch
    ? cleanHtml(titleMatch[1])
    : 'No title found';

  const description = metaDescription(html);

  const headingMatch = html.match(
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/i
  );

  const heading = headingMatch
    ? cleanHtml(headingMatch[1])
    : '';

  const companyName =
    structuredName(html) ||
    pageTitle
      .split(/\s+[–—|]\s+/)[0]
      .split(':')[0]
      .trim();

  const companyOverview = [
    heading,
    description === 'No description found'
      ? ''
      : description
  ]
    .filter(Boolean)
    .join('. ') || cleanHtml(html).slice(0, 500);

  const keywords = [
    'Microsoft 365',
    'Copilot',
    'Teams',
    'Azure',
    'Windows',
    'Xbox',
    'Surface',
    'Payroll',
    'Recruitment',
    'CRM',
    'Accounting',
    'Analytics',
    'Automation',

    // Business software categories
    'Business Software',
    'Software Suite',
    'Business Applications',
    'Customer Relationship Management',
    'Human Resources',
    'HR Management',
    'Project Management',
    'Inventory Management',
    'Email Marketing',
    'Sales Automation',
    'Marketing Automation',
    'Customer Support',
    'Help Desk',
    'Finance',
    'Collaboration',
    'Productivity',
    'Cloud Software',
    'Enterprise Software'
];

  
const text = [
  pageTitle,
  description,
  heading,
  companyOverview
].filter(Boolean).join(' ').toLowerCase();


  const hasPhrase = phrase => {
    const normalized = value => String(value).toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').trim();
    return (` ${normalized(text)} `).includes(` ${normalized(phrase)} `);
  };

  const detectedProducts = keywords.filter(hasPhrase);


const industryKeywords = {
  'Business Software': [
    'software suite',
    'business software',
    'business applications'
  ],
  'CRM Software': [
    'customer relationship management',
    'crm platform'
  ],
  'HR Technology': [
    'human resources software',
    'hr management software'
  ],
  'Financial Software': [
    'accounting software',
    'financial management software'
  ]
};

const detectedIndustries = Object.entries(industryKeywords)
  .filter(([industry, phrases]) =>
    phrases.some(hasPhrase)
  )
  .map(([industry]) => industry);

const customerKeywords = {
  'Businesses': [
    'businesses worldwide',
    'business needs'
  ],
  'Small Businesses': [
    'small businesses',
    'small business'
  ],
  'Enterprises': [
    'large enterprises',
    'enterprise customers'
  ]
};

const detectedCustomers = Object.entries(customerKeywords)
  .filter(([customer, phrases]) =>
    phrases.some(hasPhrase)
  )
  .map(([customer]) => customer);



  return {
    website: source,
    status: 'Success',
    htmlLength: html.length,
    pageTitle,
    companyName,
    description,
    detectedProducts,
    detectedIndustries,
    detectedCustomers,
    companyOverview,
    companyProfile: {
      name: companyName,
      website: source,
      description,
      products: detectedProducts,
      industries: detectedIndustries,
      customers: detectedCustomers,
      overview: companyOverview,
      source
    }
  };
}

// 10. Fetch HTML through a validated connection
async function fetchPage(input, redirectsLeft = MAX_REDIRECTS) {
  const url = parseWebsiteUrl(input);

  const check = await checkWebsiteDNS(url.href);

  if (!check.allAllowed) {
    throw new Error(
      'Website resolves to an unsafe IP address.'
    );
  }

  // Use the checked IP address for the connection.
  const selected =
    check.addresses.find(item => item.family === 4) ||
    check.addresses[0];

  const client = url.protocol === 'https:'
    ? https
    : http;

  const result = await new Promise((resolve, reject) => {
    const req = client.request(url, {
      method: 'GET',
      agent: false,

      
lookup: (_hostname, options, callback) => {
  if (options.all) {
    callback(null, [
      {
        address: selected.address,
        family: selected.family
      }
    ]);
  } else {
    callback(
      null,
      selected.address,
      selected.family
    );
  }
},


      headers: {
        'User-Agent': 'BusinessSynergyResearchPrototype/1.0',
        Accept: 'text/html',
        'Accept-Encoding': 'identity'
      },

      timeout: TIMEOUT_MS
    }, res => {
      const status = res.statusCode || 0;

      // Handle redirects
      if (status >= 300 && status < 400) {
        const location = res.headers.location;

        res.resume();

        if (!location) {
          return reject(
            new Error('Redirect missing Location header.')
          );
        }

        return resolve({
          redirect: new URL(location, url).href
        });
      }

      // Handle unsuccessful responses
      if (status < 200 || status >= 300) {
        res.resume();

        return reject(
          new Error(`Website returned status ${status}`)
        );
      }

      // Accept HTML only
      const type = String(
        res.headers['content-type'] || ''
      );

      if (!/^text\/html\b/i.test(type)) {
        res.resume();

        return reject(
          new Error('Website did not return HTML.')
        );
      }

      // Check advertised response size
      const advertised = Number(
        res.headers['content-length']
      );

      if (
        Number.isFinite(advertised) &&
        advertised > MAX_BYTES
      ) {
        res.destroy();

        return reject(
          new Error('Website response is too large.')
        );
      }

      const chunks = [];
      let total = 0;

      // Read response with a size limit
      res.on('data', chunk => {
        total += chunk.length;

        if (total > MAX_BYTES) {
          res.destroy(
            new Error('Website response is too large.')
          );
          return;
        }

        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          html: Buffer.concat(chunks).toString('utf8'),
          finalUrl: url.href
        });
      });

      res.on('error', reject);
    });

    req.on('timeout', () => {
      req.destroy(
        new Error('Website request timed out.')
      );
    });

    req.on('error', reject);

    req.end();
  });

  // Validate each redirect separately.
  if (result.redirect) {
    if (redirectsLeft === 0) {
      throw new Error('Too many website redirects.');
    }

    return fetchPage(
      result.redirect,
      redirectsLeft - 1
    );
  }

  return result;
}

// 11. Main research function
async function researchWebsite(websiteUrl) {
  try {
    const { html, finalUrl } = await fetchPage(websiteUrl);

    return extractCompanyProfile(html, finalUrl);
  } catch (error) {
    return {
      website: websiteUrl,
      status: 'Failed',
      error: error.message
    };
  }
}

// 12. Export functions
module.exports = {
  researchWebsite,
  isPublicIP,
  checkWebsiteDNS
};
