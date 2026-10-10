
const normalize = s =>
  String(s ?? '').toLowerCase().trim();

const tokens = s =>
  normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(x => x.length > 2);

// ----------------------------------------
// 1. BUSINESS CATEGORIES
// ----------------------------------------

const GROUPS = {
  'people operations': [
    'hr', 'human resources', 'employee',
    'workforce', 'payroll', 'recruitment',
    'recruiting', 'talent', 'training',
    'learning', 'benefits', 'attendance'
  ],
  'finance operations': [
    'accounting', 'finance', 'invoicing',
    'payments', 'billing', 'tax', 'expense'
  ],
  'customer growth': [
    'crm', 'sales', 'marketing', 'customer',
    'support', 'helpdesk', 'analytics', 'email'
  ],
  commerce: [
    'commerce', 'ecommerce', 'retail',
    'inventory', 'shipping', 'point of sale'
  ],
  'developer tools': [
    'developer', 'api', 'security', 'cloud',
    'devops', 'testing', 'monitoring',
    'infrastructure'
  ]
};

// ----------------------------------------
// 2. PRODUCT IDENTIFICATION
// ----------------------------------------

// More specific types are checked first.
// This avoids classifying "employee training"
// as generic HR management.

const PRODUCT_TYPES = {
  payroll: [
    'payroll', 'salary processing',
    'wage management', 'payroll processing'
  ],
  training: [
    'employee training', 'learning management',
    'corporate learning', 'training software',
    'learning platform'
  ],
  benefits: [
    'employee benefits', 'benefits administration',
    'benefits management', 'health benefits'
  ],
  recruitment: [
    'recruitment', 'recruiting',
    'applicant tracking', 'hiring software',
    'talent acquisition'
  ],
  analytics: [
    'hr analytics', 'people analytics',
    'workforce analytics', 'employee analytics'
  ],
  hr: [
    'hr management', 'human resources',
    'employee management', 'attendance',
    'hr software', 'hrms', 'hris'
  ],
  accounting: [
    'accounting', 'bookkeeping',
    'financial reporting'
  ],
  crm: [
    'crm', 'customer relationship management',
    'sales pipeline'
  ],
  ecommerce: [
    'ecommerce', 'e-commerce',
    'online shopping', 'online store'
  ],
  developer: [
    'developer tools', 'api management',
    'devops', 'software testing'
  ]
};

function detectProductType(text) {
  const value = ` ${normalize(text).replace(/[^a-z0-9]+/g, ' ')} `;

  for (const [type, keywords] of Object.entries(PRODUCT_TYPES)) {
    if (keywords.some(keyword => {
      const phrase = normalize(keyword)
        .replace(/[^a-z0-9]+/g, ' ');
      return value.includes(` ${phrase} `);
    })) {
      return type;
    }
  }

  return 'unknown';
}

// ----------------------------------------
// 3. PRODUCT RELATIONSHIPS
// ----------------------------------------

// These scores are illustrative strategic-fit
// weights, not verified acquisition outcomes.

const RELATIONSHIPS = {
  hr: {
    payroll: 95,
    training: 82,
    benefits: 86,
    recruitment: 80,
    analytics: 88,
    ecommerce: 20,
    accounting: 55,
    crm: 35,
    developer: 30
  },
  payroll: {
    benefits: 85,
    accounting: 88,
    analytics: 75,
    recruitment: 65,
    training: 55
  },
  training: {
    recruitment: 75,
    analytics: 72,
    benefits: 60
  },
  recruitment: {
    analytics: 85,
    benefits: 65
  },
  accounting: {
    ecommerce: 68,
    crm: 55
  },
  crm: {
    ecommerce: 78,
    analytics: 80
  },
  ecommerce: {
    developer: 45
  }
};

function productFit(baseType, targetType) {
  if (
    baseType === 'unknown' ||
    targetType === 'unknown'
  ) {
    return null;
  }

  // Identical products may compete rather than
  // complement each other.
  if (baseType === targetType) {
    return 60;
  }

  return (
    RELATIONSHIPS[baseType]?.[targetType] ??
    RELATIONSHIPS[targetType]?.[baseType] ??
    35
  );
}

// ----------------------------------------
// 4. CATEGORY AND TEXT SIMILARITY
// ----------------------------------------

function category(text) {
  const words = new Set(tokens(text));

  let best = null;
  let highest = 0;

  for (const [name, terms] of Object.entries(GROUPS)) {
    let count = 0;

    for (const term of terms) {
      const termWords = tokens(term);

      if (
        termWords.length &&
        termWords.every(word => words.has(word))
      ) {
        count++;
      }
    }

    if (count > highest) {
      highest = count;
      best = name;
    }
  }

  return best;
}

function overlap(a, b) {
  const first = new Set(tokens(a));
  const second = new Set(tokens(b));

  if (!first.size || !second.size) {
    return null;
  }

  const common = [...first].filter(
    word => second.has(word)
  ).length;

  return Math.round(
    (common / Math.max(
      1,
      Math.min(first.size, second.size)
    )) * 100
  );
}

// ----------------------------------------
// 5. CUSTOMER SIMILARITY
// ----------------------------------------

const CUSTOMER_GROUPS = {
  small_business: [
    'small business', 'small businesses',
    'smb', 'smes', 'small and medium',
    'small to medium'
  ],
  enterprise: [
    'enterprise', 'large companies',
    'large businesses', 'corporations'
  ],
  hr_teams: [
    'hr teams', 'hr departments',
    'human resources teams'
  ],
  retailers: [
    'retailers', 'retail stores',
    'online retailers', 'online sellers'
  ],
  developers: [
    'developers', 'engineering teams',
    'software teams'
  ]
};

function customerGroups(text) {
  const value = normalize(text);
  const found = [];

  for (const [group, phrases] of Object.entries(CUSTOMER_GROUPS)) {
    if (phrases.some(phrase => value.includes(phrase))) {
      found.push(group);
    }
  }

  return found;
}

function customerFit(baseCustomers, targetCustomers) {
  if (!baseCustomers || !targetCustomers) {
    return null;
  }

  const first = customerGroups(baseCustomers);
  const second = customerGroups(targetCustomers);

  if (first.length && second.length) {
    const common = first.filter(
      group => second.includes(group)
    );

    if (common.length) {
      return 91;
    }

    return 35;
  }

  const similarity = overlap(
    baseCustomers,
    targetCustomers
  );

  if (similarity === null) {
    return null;
  }

  if (similarity >= 55) return 88;
  if (similarity >= 25) return 68;
  if (similarity > 0) return 50;

  return 30;
}

// ----------------------------------------
// 6. INDUSTRY SIMILARITY
// ----------------------------------------

function industryFit(base, target, baseCategory, targetCategory) {
  if (!base.industry || !target.industry) {
    return null;
  }

  if (
    normalize(base.industry) ===
    normalize(target.industry)
  ) {
    return 88;
  }

  if (
    baseCategory &&
    targetCategory &&
    baseCategory === targetCategory
  ) {
    return 82;
  }

  const similarity = overlap(
    base.industry,
    target.industry
  );

  if (similarity !== null && similarity >= 50) {
    return 65;
  }

  return 28;
}

// ----------------------------------------
// 7. COMPANY-SPECIFIC EXPLANATIONS
// ----------------------------------------

function explainRelationship(baseType, targetType) {
  const hrExplanations = {
    payroll: {
      reason:
        'Payroll software could complement HR and attendance management.',
      opportunity:
        'Potential to offer employee management and payroll together.',
      nextAction:
        'Verify shared customer segments, payroll integration requirements, and compliance.'
    },
    training: {
      reason:
        'Employee training software could extend HR management workflows.',
      opportunity:
        'Potential to combine employee management and learning services.',
      nextAction:
        'Investigate learning-system integration and customer demand.'
    },
    benefits: {
      reason:
        'Benefits administration could complement employee management.',
      opportunity:
        'Potential to offer HR and employee benefits through one solution.',
      nextAction:
        'Review benefits compliance, customer demand, and integration costs.'
    },
    recruitment: {
      reason:
        'Recruitment software could connect hiring with employee management.',
      opportunity:
        'Potential to support the employee lifecycle from recruitment onward.',
      nextAction:
        'Check applicant-tracking integration and shared buyer needs.'
    },
    analytics: {
      reason:
        'People analytics could provide additional insights into HR operations.',
      opportunity:
        'Potential to combine HR workflows with workforce reporting.',
      nextAction:
        'Review available data integrations and reporting requirements.'
    }
  };

  if (baseType === 'hr' && hrExplanations[targetType]) {
    return hrExplanations[targetType];
  }

  if (baseType === targetType && baseType !== 'unknown') {
    return {
      reason:
        'Both companies offer similar products and may serve overlapping markets.',
      opportunity:
        'Potential market expansion or consolidation rather than product complementarity.',
      nextAction:
        'Investigate competitive overlap, customer concentration, and integration risks.'
    };
  }

  if (
    baseType === 'unknown' ||
    targetType === 'unknown'
  ) {
    return {
      reason:
        'There is insufficient product information to establish a specific relationship.',
      opportunity:
        'A potential opportunity may emerge after product research.',
      nextAction:
        'Verify the company product, customer segments, and core business activities.'
    };
  }

  return {
    reason:
      `The ${targetType} offering may have a strategic relationship with the ${baseType} business.`,
    opportunity:
      'Explore possible product integration, cross-selling, or market expansion.',
    nextAction:
      'Validate customer overlap, integration feasibility, and commercial demand.'
  };
}

// ----------------------------------------
// 8. WEBSITE VALIDATION
// ----------------------------------------

function safeDomain(s) {
  try {
    const value = String(s || '').trim();

    if (!value) return '';

    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
        ? value
        : `https://${value}`
    );

    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    const hostname = url.hostname
      .replace(/^www\./, '')
      .toLowerCase();

    if (
      !hostname.includes('.') ||
      hostname.includes(' ')
    ) {
      return '';
    }

    return hostname;
  } catch {
    return '';
  }
}

// ----------------------------------------
// 9. DUPLICATE DETECTION
// ----------------------------------------

function dedupe(rows) {
  const seenDomains = new Map();
  const seenNames = new Map();

  const unique = [];
  const removed = [];

  for (const row of rows) {
    const domain = safeDomain(row.website);
    const name = normalize(row.name)
      .replace(/[^a-z0-9]/g, '');

    if (!name) continue;

    let duplicateOf = null;
    let reason = '';

    if (domain && seenDomains.has(domain)) {
      duplicateOf = seenDomains.get(domain);
      reason = 'Matching website domain';
    } else if (seenNames.has(name)) {
      duplicateOf = seenNames.get(name);
      reason = 'Matching company name';
    }

    if (duplicateOf) {
      removed.push({
        name: row.name,
        duplicateOf,
        reason
      });
      continue;
    }

    unique.push(row);

    seenNames.set(name, row.name);

    if (domain) {
      seenDomains.set(domain, row.name);
    }
  }

  return {
    rows: unique,
    duplicates: removed.length,
    removed
  };
}

// ----------------------------------------
// 10. SYNERGY SCORING ENGINE
// ----------------------------------------

function scoreOne(base, target) {
  const baseCategory = category(
    `${base.industry || ''} ${base.product || ''}`
  );

  const targetCategory = category(
    `${target.industry || ''} ${target.product || ''}`
  );

  const baseType = detectProductType(
    base.product || ''
  );

  const targetType = detectProductType(
    target.product || ''
  );

  const product = (
    base.product && target.product
  )
    ? productFit(baseType, targetType)
    : null;

  const customer = customerFit(
    base.customers,
    target.customers
  );

  const industry = industryFit(
    base,
    target,
    baseCategory,
    targetCategory
  );

  const factors = [
    ['product', product, 0.45],
    ['customer', customer, 0.35],
    ['industry', industry, 0.20]
  ];

  const known = factors.filter(
    factor => factor[1] !== null
  );

  const knownWeight = known.reduce(
    (sum, factor) => sum + factor[2],
    0
  );

  // Missing factors are excluded instead of
  // being treated as poor matches.
  const score = knownWeight
    ? Math.round(
        known.reduce(
          (sum, factor) =>
            sum + factor[1] * factor[2],
          0
        ) / knownWeight
      )
    : null;

  const missing = [];

  if (!target.website) {
    missing.push('Website');
  }

  if (!target.product) {
    missing.push('Product description');
  }

  if (!target.customers) {
    missing.push('Target customers');
  }

  if (!target.industry) {
    missing.push('Industry');
  }

  const insight = explainRelationship(
    baseType,
    targetType
  );

  const reasons = [insight.reason];

  if (customer !== null) {
    if (customer >= 80) {
      reasons.push(
        'Customer descriptions suggest overlap; cross-selling may be possible.'
      );
    } else if (customer >= 50) {
      reasons.push(
        'Some customer similarity is present, but shared buyers need verification.'
      );
    } else {
      reasons.push(
        'Customer segments appear different; commercial overlap needs investigation.'
      );
    }
  } else {
    reasons.push(
      'Target customer information is missing; customer overlap cannot be assessed.'
    );
  }

  const warnings = [
    'Fit score is a screening heuristic, not a valuation or acquisition recommendation.'
  ];

  if (missing.length) {
    warnings.push(
      `Missing: ${missing.join(', ')}.`
    );
  }

  if (known.length < 3) {
    warnings.push(
      `Score uses ${Math.round(knownWeight * 100)}% of available factor weights; missing factors are excluded. Interpret cautiously.`
    );
  }

  if (
    target.website &&
    !safeDomain(target.website)
  ) {
    warnings.push(
      'Website format is invalid or unsupported.'
    );
  }

  const domain = safeDomain(target.website);

  if (
    domain.endsWith('.example') ||
    domain.endsWith('.test') ||
    domain.endsWith('.invalid')
  ) {
    warnings.push(
      'Website uses a demonstration domain and is not evidence of a verified company.'
    );
  }

  let confidence = 'Low coverage';

  if (known.length === 3) {
    confidence = 'Higher coverage';
  } else if (known.length === 2) {
    confidence = 'Partial coverage';
  }

  return {
    ...target,
    score,
    confidence,
    coverage: Math.round(knownWeight * 100),
    factors: {
      product,
      customer,
      industry
    },
    reasons,
    opportunity: insight.opportunity,
    nextAction: insight.nextAction,
    warnings,
    missing,
    category: targetCategory || 'Unclassified'
  };
}

// ----------------------------------------
// 11. ANALYZE ALL COMPANY LEADS
// ----------------------------------------

function analyze(base, rows) {
  const clean = rows
    .map(row => ({
      name: String(row.name || '')
        .trim()
        .slice(0, 120),

      industry: String(row.industry || '')
        .trim()
        .slice(0, 180),

      product: String(row.product || '')
        .trim()
        .slice(0, 300),

      customers: String(row.customers || '')
        .trim()
        .slice(0, 240),

      website: String(row.website || '')
        .trim()
        .slice(0, 240),

      location: String(row.location || '')
        .trim()
        .slice(0, 140)
    }))
    .filter(row => row.name);

  const {
    rows: unique,
    duplicates,
    removed
  } = dedupe(clean);

  const results = unique
    .map(row => scoreOne(base, row))
    .sort((a, b) =>
      (b.score ?? -1) - (a.score ?? -1)
    );

  return {
    results,

    stats: {
      imported: rows.length,
      unique: unique.length,
      duplicates,
      missingWebsites: unique.filter(
        row => !row.website
      ).length
    },

    duplicateDetails: removed,

    method:
      'Rule-based weighted scoring using product complementarity (45%), customer similarity (35%), and industry relevance (20%). Scores are screening heuristics, not verified commercial synergy.'
  };
}

// ----------------------------------------
// 12. EXPORT FUNCTIONS
// ----------------------------------------

module.exports = {
  analyze,
  scoreOne,
  dedupe,
  safeDomain
};
