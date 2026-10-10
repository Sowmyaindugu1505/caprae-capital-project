
const $ = id => document.getElementById(id);

let targets = [];
let results = [];
let active = null;
let lastAnalysis = null;

const escapeHTML = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]
  );

function resetMetrics() {
  for (const id of ['metricTotal', 'metricStrong', 'metricDup', 'metricMissing']) {
    $(id).textContent = '—';
  }
}

const showNotice = message => {
  $('notice').textContent = message;
};

function csvParse(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if (
      (char === '\n' || char === '\r') &&
      !quoted
    ) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++;
      }

      row.push(field);

      if (row.some(value => value.trim())) {
        rows.push(row);
      }

      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) {
    throw new Error(
      'Invalid CSV: a quoted field was not closed.'
    );
  }

  row.push(field);

  if (row.some(value => value.trim())) {
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error(
      'CSV must contain a header and at least one company.'
    );
  }

  const headers = rows.shift().map(header =>
    header
      .trim()
      .toLowerCase()
      .replace(/^\ufeff/, '')
  );

  if (!headers.includes('name')) {
    throw new Error(
      'Missing required CSV column: name.'
    );
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error(
      'CSV contains duplicate column names.'
    );
  }

  const parsed = rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${index + 2} has ${values.length} columns; expected ${headers.length}.`
      );
    }

    return Object.fromEntries(
      headers.map((header, i) => [
        header,
        (values[i] || '').trim()
      ])
    );
  });

  const valid = parsed.filter(row => row.name);

  if (!valid.length) {
    throw new Error(
      'No valid company rows found.'
    );
  }

  return valid;
}

function load(text, label) {
  try {
    const parsed = csvParse(text);

    targets = parsed;
    results = [];
    active = null;
    lastAnalysis = null;

    $('dataLabel').textContent = label;
    $('dataDetail').textContent =
      `${targets.length} rows ready for analysis`;

    $('analyzeBtn').disabled = false;
    $('exportBtn').disabled = true;
    resetMetrics();

    showNotice('');
    render();
    renderDataReport(null);
  } catch (error) {
    showNotice(error.message);
  }
}

// ----------------------------------------
// LOAD SAMPLE DATA
// ----------------------------------------

$('sampleBtn').onclick = async () => {
  try {
    const response = await fetch('/sample.csv');

    if (!response.ok) {
      throw new Error('Sample dataset unavailable.');
    }

    load(
      await response.text(),
      'Sample dataset loaded'
    );
  } catch (error) {
    showNotice(error.message);
  }
};

// ----------------------------------------
// UPLOAD CSV
// ----------------------------------------

$('fileInput').onchange = async event => {
  const file = event.target.files[0];

  if (!file) return;

  if (file.size > 1500000) {
    showNotice(
      'Please select a CSV file smaller than 1.5 MB.'
    );
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    showNotice('Please select a CSV file.');
    return;
  }

  $('fileStatus').textContent = file.name;

  try {
    load(await file.text(), file.name);
  } catch (error) {
    showNotice(
      'Unable to read the selected CSV file.'
    );
  }
};

// ----------------------------------------
// RUN SYNERGY ANALYSIS
// ----------------------------------------

$('analyzeBtn').onclick = async () => {
  const base = {
    name: $('baseName').value.trim(),
    industry: $('baseIndustry').value.trim(),
    product: $('baseProduct').value.trim(),
    customers: $('baseCustomers').value.trim()
  };

  if (!base.name || !base.product) {
    showNotice(
      'Enter a company name and primary product first.'
    );
    return;
  }

  if (!targets.length) {
    showNotice(
      'Upload a company CSV or load the sample dataset.'
    );
    return;
  }

  const button = $('analyzeBtn');

  button.disabled = true;
  button.textContent = 'Analyzing...';

  showNotice('');

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base,
        targets
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || 'Analysis failed.'
      );
    }

    results = Array.isArray(data.results)
      ? data.results
      : [];

    lastAnalysis = data;

    active = results[0]?.name || null;

    $('metricTotal').textContent =
      data.stats?.unique ?? 0;

    $('metricStrong').textContent =
      results.filter(
        company => company.score !== null &&
          company.score >= 75
      ).length;

    $('metricDup').textContent =
      data.stats?.duplicates ?? 0;

    $('metricMissing').textContent =
      data.stats?.missingWebsites ?? 0;

    $('exportBtn').disabled = results.length === 0;

    render();
    renderDataReport(data);

    $('results').scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  } catch (error) {
    showNotice(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML =
      'Run synergy analysis <span>↗</span>';
  }
};

// ----------------------------------------
// FILTER RESULTS
// ----------------------------------------

function visible() {
  const query = $('searchInput').value
    .toLowerCase()
    .trim();

  const filter = $('filterSelect').value;

  return results.filter(company => {
    const searchable = [
      company.name,
      company.product,
      company.industry,
      company.location
    ].join(' ').toLowerCase();

    const matchesSearch = searchable.includes(query);

    const matchesFilter =
      filter === 'all' ||
      (
        filter === 'strong' &&
        company.score !== null &&
        company.score >= 75
      ) ||
      (
        filter === 'review' &&
        (
          company.score === null ||
          company.score < 75
        )
      ) ||
      (
        filter === 'incomplete' &&
        company.missing.length > 0
      );

    return matchesSearch && matchesFilter;
  });
}

// ----------------------------------------
// DISPLAY FIT FACTORS
// ----------------------------------------

function renderFactor(label, value) {
  const available =
    typeof value === 'number' &&
    Number.isFinite(value);

  const score = available
    ? Math.max(0, Math.min(100, value))
    : 0;

  return `
    <div class="factor">
      <div class="factor-top">
        <span>${escapeHTML(label)}</span>
        <strong>
          ${available ? `${score}/100` : 'Not available'}
        </strong>
      </div>

      <div class="track">
        <div
          class="fill"
          style="width:${score}%"
        ></div>
      </div>
    </div>
  `;
}

// ----------------------------------------
// DISPLAY BUSINESS INSIGHTS
// ----------------------------------------

function renderInsight(title, description) {
  return `
    <h4>${escapeHTML(title)}</h4>

    <div class="insight-box">
      <p>
        ${escapeHTML(
          description || 'Further research is required.'
        )}
      </p>
    </div>
  `;
}

// ----------------------------------------
// RENDER COMPANY RESULTS
// ----------------------------------------

function render() {
  const companies = visible();

  $('countLabel').textContent =
    `${companies.length} results`;

  $('leadList').innerHTML = companies.length
    ? companies.map(company => `
        <div
          class="lead ${
            active === company.name ? 'selected' : ''
          }"
          role="button"
          tabindex="0"
          data-name="${escapeHTML(company.name)}"
        >
          <div>
            <div class="lead-name">
              ${escapeHTML(company.name)}
            </div>

            <div class="lead-meta">
              ${escapeHTML(
                company.industry || 'Unclassified'
              )}
              ·
              ${escapeHTML(
                company.location || 'Location unavailable'
              )}
            </div>

            <div class="lead-reason">
              ${escapeHTML(
                company.reasons?.[0] ||
                'Further research required.'
              )}
            </div>
          </div>

          <div class="score ${
            company.score !== null &&
            company.score < 60 ? 'weak' : ''
          }">
            ${company.score ?? '—'}
            <small>/ 100</small>
          </div>
        </div>
      `).join('')
    : `
      <div class="empty">
        <h3>No matching companies</h3>
        <p>Adjust your search or filter.</p>
      </div>
    `;

  $('leadList')
    .querySelectorAll('.lead')
    .forEach(element => {
      const select = () => {
        active = element.dataset.name;
        render();
      };

      element.onclick = select;

      element.onkeydown = event => {
        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {
          event.preventDefault();
          select();
        }
      };
    });

  const company = results.find(
    item => item.name === active
  );

  if (!company) {
    $('detail').innerHTML = `
      <div class="detail-empty">
        Select a company to review its
        fit breakdown and research notes.
      </div>
    `;
    return;
  }

  const reasons = Array.isArray(company.reasons)
    ? company.reasons
    : [];

  const warnings = Array.isArray(company.warnings)
    ? company.warnings
    : [];

  $('detail').innerHTML = `
    <div class="detail-top">
      <div>
        <h3>${escapeHTML(company.name)}</h3>

        <div class="sub">
          ${escapeHTML(
            company.product ||
            'Product information missing'
          )}
        </div>
      </div>

      <span class="pill">
        ${escapeHTML(company.confidence)}
      </span>
    </div>

    <h4>FIT BREAKDOWN</h4>
    <p class="coverage-note">Evidence coverage: ${escapeHTML(company.coverage ?? 'Unknown')}% of scoring weight. Unavailable factors are excluded, not scored as zero.</p>

    ${renderFactor(
      'Product complementarity · 45%',
      company.factors?.product
    )}

    ${renderFactor(
      'Customer similarity · 35%',
      company.factors?.customer
    )}

    ${renderFactor(
      'Industry relevance · 20%',
      company.factors?.industry
    )}

    <h4>WHY THIS COMPANY?</h4>

    <ul>
      ${reasons.map(reason => `
        <li>${escapeHTML(reason)}</li>
      `).join('')}
    </ul>

    ${renderInsight(
      'POTENTIAL BUSINESS OPPORTUNITY',
      company.opportunity
    )}

    ${renderInsight(
      'RECOMMENDED NEXT STEP',
      company.nextAction
    )}

    <h4>RESEARCH CHECKS</h4>

    <ul>
      ${warnings.map(warning => `
        <li>${escapeHTML(warning)}</li>
      `).join('')}
    </ul>

    ${company.website ? `
      <div class="warning">
        Website on record:
        ${escapeHTML(company.website)}
        <br>
        Website presence is not proof
        of verification.
      </div>
    ` : ''}
  `;
}

// ----------------------------------------
// DATA QUALITY REPORT
// ----------------------------------------

function renderDataReport(data) {
  let report = $('dataReport');

  if (!report) {
    report = document.createElement('details');
    report.id = 'dataReport';
    report.className = 'data-report';

    const summary = document.createElement('summary');
    summary.textContent = 'View data quality report';

    const content = document.createElement('div');
    content.id = 'dataReportContent';

    report.append(summary, content);

    const resultsSection = $('results');

    if (resultsSection) {
      resultsSection.insertAdjacentElement(
        'afterend',
        report
      );
    }
  }

  if (!data) {
    report.hidden = true;
    return;
  }

  report.hidden = false;

  const stats = data.stats || {};
  const duplicates = data.duplicateDetails || [];

  const duplicateItems = duplicates.length
    ? duplicates.map(item => `
        <li>
          <strong>${escapeHTML(item.name)}</strong>
          — ${escapeHTML(item.reason)}
          (duplicate of
          ${escapeHTML(item.duplicateOf)})
        </li>
      `).join('')
    : '<li>No duplicate records detected.</li>';

  const incomplete = results.filter(
    company => company.missing?.length
  );

  const incompleteItems = incomplete.length
    ? incomplete.map(company => `
        <li>
          <strong>${escapeHTML(company.name)}</strong>
          — Missing:
          ${escapeHTML(company.missing.join(', '))}
        </li>
      `).join('')
    : '<li>No missing profile fields detected.</li>';

  $('dataReportContent').innerHTML = `
    <div class="data-report-grid">
      <div>
        <h4>DATA SUMMARY</h4>
        <p>
          Imported records:
          <strong>${stats.imported ?? 0}</strong>
        </p>
        <p>
          Unique companies:
          <strong>${stats.unique ?? 0}</strong>
        </p>
        <p>
          Duplicates removed:
          <strong>${stats.duplicates ?? 0}</strong>
        </p>
        <p>
          Missing websites:
          <strong>${stats.missingWebsites ?? 0}</strong>
        </p>
      </div>

      <div>
        <h4>DUPLICATE RECORDS</h4>
        <ul>${duplicateItems}</ul>
      </div>

      <div>
        <h4>INCOMPLETE PROFILES</h4>
        <ul>${incompleteItems}</ul>
      </div>
    </div>
  `;
}

// ----------------------------------------
// SEARCH AND FILTER EVENTS
// ----------------------------------------

$('searchInput').oninput = render;
$('filterSelect').onchange = render;

// ----------------------------------------
// EXPORT SHORTLIST
// ----------------------------------------

$('exportBtn').onclick = () => {
  const companies = visible();

  if (!companies.length) {
    showNotice('No companies available for export.');
    return;
  }

  const headers = [
    'name',
    'industry',
    'product',
    'customers',
    'website',
    'location',
    'score',
    'confidence',
    'opportunity',
    'nextAction',
    'research_notes'
  ];

  const csvCell = value =>
    '"' + String(value ?? '')
      .replace(/^[\s]*[=+\-@\t\r\n]/, "'$&")
      .replace(/"/g, '""') + '"';

  const csv = [
    headers.join(','),

    ...companies.map(company =>
      headers.map(header => {
        let value = company[header];

        if (header === 'research_notes') {
          value = (company.warnings || [])
            .join(' | ');
        }

        return csvCell(value);
      }).join(',')
    )
  ].join('\r\n');

  const blob = new Blob(
    [csv],
    { type: 'text/csv;charset=utf-8' }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'synergy-shortlist.csv';

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};


/* CLEAR LEAD LIST FEATURE */

const clearLeadButton = document.createElement('button');

clearLeadButton.type = 'button';
clearLeadButton.textContent = 'Clear Lead List';
clearLeadButton.style.marginLeft = '12px';
clearLeadButton.style.padding = '10px 16px';
clearLeadButton.style.border = '1px solid #ef4444';
clearLeadButton.style.borderRadius = '6px';
clearLeadButton.style.background = 'transparent';
clearLeadButton.style.color = '#f87171';
clearLeadButton.style.cursor = 'pointer';

const analyzeButton = document.getElementById('analyzeBtn');

analyzeButton.insertAdjacentElement('afterend', clearLeadButton);

clearLeadButton.addEventListener('click', () => {

  if (!targets.length) {
    alert('Your lead list is already empty.');
    return;
  }

  const confirmed = confirm(
    `Clear all ${targets.length} companies from your lead list?`
  );

  if (!confirmed) return;

  // Clear all imported and researched leads.
  targets = [];

  // Remove previous analysis results.
  results = [];
  active = null;
  lastAnalysis = null;

  // Reset dashboard information.
  $('dataLabel').textContent = 'No leads loaded';
  $('dataDetail').textContent =
    'Import a CSV or research a company to begin.';

  $('analyzeBtn').disabled = true;
  $('exportBtn').disabled = true;

  resetMetrics();

  // Clear any selected CSV file.
  const fileInput = $('fileInput');

  if (fileInput) {
    fileInput.value = '';
    $('fileStatus').textContent = 'No file selected';
  }

  render();
  renderDataReport(null);

  showNotice('Lead list cleared successfully.');
});

// ----------------------------------------
// INITIAL DISPLAY
// ----------------------------------------

render();


/* =====================================
   CONNECT EXISTING WEBSITE RESEARCH UI
   ===================================== */

(function connectWebsiteResearch() {

  // Find the existing research section.
  const section = document.getElementById('websiteResearch');

  if (!section) {
    console.error('Website Research section not found.');
    return;
  }

  // Find the existing form and input.
  const form = section.querySelector('form');
  const input = section.querySelector('input[type="url"]');
  const button = section.querySelector('button');

  if (!input || !button) {
    console.error('Website Research controls not found.');
    return;
  }

  // Create a place to display messages.
  const status = document.createElement('div');
  status.style.marginTop = '16px';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  // Create a place to display results.
  const output = document.createElement('div');
  output.style.marginTop = '20px';

  const container = form || button.parentElement;
  container.append(status, output);

  async function runResearch(event) {
    if (event) event.preventDefault();

    const website = input.value.trim();

    if (!website) {
      status.textContent = 'Please enter a website URL.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Researching...';
    status.textContent = 'Connecting to company website...';
    output.replaceChildren();

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ website })
      });

      const data = await response.json();

      if (!response.ok || data.status === 'Failed') {
        throw new Error(
          data.error || data.message || 'Research failed.'
        );
      }

      const company = data.companyProfile || {};

      const card = document.createElement('div');
      card.className = 'panel';
      card.style.padding = '20px';

      function addField(label, value) {
        const heading = document.createElement('h4');
        heading.textContent = label;

        const paragraph = document.createElement('p');
        paragraph.textContent =
          value || 'Not available';

        card.append(heading, paragraph);
      }

      const title = document.createElement('h3');
      title.textContent =
        company.name || data.companyName || 'Unknown company';

      card.appendChild(title);

      addField(
        'Website',
        company.website || data.website
      );

      addField(
        'Description',
        company.description || data.description
      );

      const products = Array.isArray(company.products)
        ? company.products
        : data.detectedProducts || [];

      addField(
        'Detected Products',
        products.join(', ')
      );

      addField(
        'Company Overview',
        company.overview || data.companyOverview
      );

      const note = document.createElement('p');
      note.textContent =
        'Information extracted from a public website. ' +
        'Verify important details independently.';

      card.appendChild(note);

      const useButton = document.createElement('button');
      useButton.type = 'button';
      useButton.className = 'primary';
      useButton.textContent = 'Use as Reference Company';
      useButton.style.marginTop = '15px';

      useButton.onclick = () => {
        const name = company.name || data.companyName;
        const product = products.join(', ');

        if (!name || !product) {
          status.textContent =
            'Company name or product information is missing.';
          return;
        }

        document.getElementById('baseName').value = name;
        document.getElementById('baseProduct').value = product;

        document.getElementById('baseIndustry').value = industries.join(', ');
        document.getElementById('baseCustomers').value = customers.join(', ');

        // Existing analysis used the previous reference company.
        results = [];
        active = null;
        lastAnalysis = null;
        $('exportBtn').disabled = true;
        resetMetrics();
        render();
        renderDataReport(null);
        status.textContent =
          'Reference company updated. Review the detected fields before analyzing.';

        document.getElementById('analysis').scrollIntoView({
          behavior: 'smooth'
        });
      };

/* DISPLAY DETECTED INDUSTRY AND CUSTOMERS */

const industries = Array.isArray(company.industries)
  ? company.industries
  : (data.detectedIndustries || []);

const customers = Array.isArray(company.customers)
  ? company.customers
  : (data.detectedCustomers || []);

const industrySection = document.createElement('div');

const industryHeading = document.createElement('h4');
industryHeading.textContent = 'Detected Industry';

const industryText = document.createElement('p');
industryText.textContent = industries.length
  ? industries.join(', ')
  : 'Not detected';

industrySection.appendChild(industryHeading);
industrySection.appendChild(industryText);

const customerSection = document.createElement('div');

const customerHeading = document.createElement('h4');
customerHeading.textContent = 'Detected Target Customers';

const customerText = document.createElement('p');
customerText.textContent = customers.length
  ? customers.join(', ')
  : 'Not detected';

customerSection.appendChild(customerHeading);
customerSection.appendChild(customerText);

card.appendChild(industrySection);
card.appendChild(customerSection);

      card.appendChild(useButton);

/* ADD RESEARCHED COMPANY TO LEAD LIST */

const addLeadButton = document.createElement('button');

addLeadButton.type = 'button';
addLeadButton.textContent = '+ Add to Lead List';
addLeadButton.className = 'primary';
addLeadButton.style.marginTop = '12px';
addLeadButton.style.marginLeft = '10px';

addLeadButton.onclick = () => {

  const name = company.name || data.companyName;

  const product = products.join(', ');

  const website = company.website || data.website;

  if (!name) {
    status.textContent = 'Company name is missing.';
    return;
  }

  // Avoid duplicate companies.
  const domainOf = value => {
    try { return new URL(value).hostname.replace(/^www\./i, '').toLowerCase(); }
    catch { return ''; }
  };
  const alreadyExists = targets.some(item =>
    item.name.trim().toLowerCase() === name.trim().toLowerCase() ||
    (domainOf(website) && domainOf(item.website) === domainOf(website))
  );

  if (alreadyExists) {
    status.textContent =
      'This company is already in your lead list.';
    return;
  }

  // Create a lead from the researched information.
  const newLead = {
    name: name,
    industry: industries.join(', '),
    product: product,
    customers: customers.join(', '),
    website: website || '',
    location: ''
  };

  targets.push(newLead);

  // Existing analysis results are now outdated.
  results = [];
  active = null;
  lastAnalysis = null;

  // Update the dashboard.
  $('dataLabel').textContent =
    'Researched company leads';

  $('dataDetail').textContent =
    `${targets.length} companies ready for analysis`;

  $('analyzeBtn').disabled = false;
  $('exportBtn').disabled = true;

  resetMetrics();

  render();
  renderDataReport(null);

  status.textContent =
    `${name} added to your lead list successfully!`;
  showNotice('');

  addLeadButton.disabled = true;
  addLeadButton.textContent = 'Added to Lead List ✓';
};

card.appendChild(addLeadButton);

      output.appendChild(card);

      status.textContent =
        'Company research completed successfully!';

    } catch (error) {
      status.textContent =
        'Research failed: ' + error.message;

      console.error('Website research error:', error);
    } finally {
      button.disabled = false;
      button.textContent = 'Research Company ↗';
    }
  }

  // Handle clicks.
  if (form) {
    form.addEventListener('submit', runResearch);
    button.type = 'submit';
  } else {
    button.type = 'button';
    button.addEventListener('click', runResearch);
  }

})();


