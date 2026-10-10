# Caprae Capital Project — Business Synergy Finder

A web-based tool for researching companies, organizing leads, and identifying potential business opportunities through explainable synergy scoring.

Built as an independent project for the **Caprae Capital Full Stack Developer Assessment**, inspired by the company discovery workflow of SaaSquatch Leads.

## Overview

Finding companies is only the first part of lead generation. Once a list is collected, the next challenge is deciding which companies are worth investigating further.

I built Business Synergy Finder to help with that process. The application allows users to research public company websites, import company lists, compare businesses against a reference company, and rank potential matches.

Instead of relying on a score alone, the tool also shows the factors behind each result, possible business opportunities, missing information, and recommended next steps.

The goal is to make the initial company screening process more organized and easier to review.

## Key Features

### 1. Website Research

Users can enter a company website URL and retrieve available company information from its public webpage.

The research feature attempts to identify:

- Company name and website
- Company description and overview
- Products and services
- Industry
- Target customers

The extracted information is displayed for review. Users can then add the company to their lead list or use it as their reference company.

Product, industry, and customer classifications are based on keyword matching. They are preliminary findings and should be verified before making business decisions.

### 2. Lead Management

Companies can be added through website research, CSV uploads, or the included sample dataset.

The application supports:

- Adding researched companies to a lead list
- Importing company records from CSV
- Detecting duplicate company names and website domains
- Identifying incomplete company profiles
- Clearing the lead list when starting a new analysis

Duplicate checks help reduce repeated entries and keep the results organized.

### 3. Business Synergy Analysis

The scoring engine compares each lead against a reference company using three factors:

| Factor                  | Weight |
| ----------------------- | -----: |
| Product Complementarity |    45% |
| Customer Similarity     |    35% |
| Industry Relevance      |    20% |

Product complementarity checks whether the companies' offerings could support each other. Customer similarity looks for overlapping customer segments, while industry relevance considers how closely related their business activities are.

The scoring logic is implemented in `scoring.js` using product relationship rules, category dictionaries, and text matching.

When a factor cannot be evaluated, it is excluded from the weighted calculation rather than assigned an artificial score.

The results also show **Evidence Coverage**, which indicates how much of the weighted scoring information was available.

For example, a company can receive a high synergy score while having incomplete product information. The evidence coverage helps users recognize that limitation.

Scores are intended for initial screening. They do not represent acquisition probabilities, financial valuations, or confirmed commercial relationships.

### 4. Explainable Results

Each analyzed company includes more than a numerical score.

The results provide:

- Overall synergy score
- Product, customer, and industry scores
- Evidence coverage
- Reasons behind the potential match
- Possible business opportunities
- Recommended next actions
- Missing information and research warnings

These explanations help users understand why a company appears in the shortlist and what needs to be checked before moving forward.

### 5. Search, Filtering, and CSV Export

Analysis results are ranked by synergy score.

Users can search and filter the results, review individual company details, and export a shortlist as a CSV file.

The exported file includes company information, scoring results, and research notes for further review.

## Technology Stack

| Component          | Technology                                               |
| ------------------ | -------------------------------------------------------- |
| Frontend           | HTML5, CSS3, JavaScript                                  |
| Backend            | Node.js                                                  |
| HTTP Server        | Node.js built-in `http` module                           |
| Website Research   | Node.js HTTP/HTTPS requests and HTML metadata extraction |
| Scoring Engine     | Rule-based JavaScript                                    |
| Data Import/Export | CSV                                                      |
| Testing            | Node.js built-in test runner                             |

The project uses JavaScript across the frontend and backend. No external npm packages or paid APIs are required.

## Project Architecture

The application follows a simple client-server structure.

```text
Browser
  |
  |-- Website Research
  |-- Reference Company
  |-- Lead Management
  |-- Analysis Results
  |-- CSV Import / Export
  |
  v
Node.js HTTP Server (server.js)
  |
  |-- POST /api/research
  |      |
  |      v
  |   websiteResearch.js
  |      |
  |      v
  |   Public Website Information
  |
  |-- POST /api/analyze
         |
         v
      scoring.js
         |
         v
      Ranked Results
```

### Main Files

| File                 | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `server.js`          | Serves the frontend and handles API requests                          |
| `websiteResearch.js` | Fetches and extracts information from public websites                 |
| `scoring.js`         | Calculates synergy scores, explanations, and data-quality information |
| `public/index.html`  | Dashboard structure                                                   |
| `public/style.css`   | Dashboard styling                                                     |
| `public/app.js`      | Frontend interactions, lead management, analysis, and CSV handling    |
| `tests/`             | Automated tests                                                       |
| `package.json`       | Project scripts and configuration                                     |

## Getting Started

### Requirements

- Node.js 18 or later
- A modern web browser
- Internet access for researching external websites

### Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/caprae-capital-project.git
```

Open the project folder:

```bash
cd caprae-capital-project
```

Start the application:

```bash
npm start
```

Open the dashboard:

```text
http://127.0.0.1:3000
```

The project does not require `npm install` because it uses Node.js built-in modules.

## How to Use

### Research a Company

1. Open the Website Research section.
2. Enter a public company website URL.
3. Click the research button.
4. Review the extracted company information.
5. Select **Add to Lead List** or **Use as Reference Company**.

### Analyze Potential Matches

1. Enter or select a reference company.
2. Add companies through website research or CSV import.
3. Click **Run Synergy Analysis**.
4. Review the ranked results.
5. Check the score breakdown, explanations, and evidence coverage.
6. Use search and filters to narrow the results.
7. Export the shortlist for further research.

### CSV Format

The application accepts CSV files using the following columns:

```csv
name,industry,product,customers,website,location
```

Example:

```csv
name,industry,product,customers,website,location
PayEase,HR Software,Payroll software,Small businesses,https://payease.example,USA
LearnFlow,HR Technology,Employee training platform,HR teams,https://learnflow.example,USA
```

These are fictional examples. The `.example` domains are placeholders, not real company websites.

Only the company name is required, although incomplete records may have limited scoring information.

## API Endpoints

### POST /api/research

Researches a publicly accessible company website.

Request:

```json
{
  "website": "https://www.zoho.com/"
}
```

The response contains available website information and extracted company fields.

Some websites may block automated requests or provide insufficient information for classification.

### POST /api/analyze

Compares a reference company against a list of target companies.

Request:

```json
{
  "base": {
    "name": "PeopleFlow",
    "industry": "HR Software",
    "product": "Employee management and attendance software",
    "customers": "Small and medium businesses"
  },
  "targets": [
    {
      "name": "PayEase",
      "industry": "HR Software",
      "product": "Payroll software",
      "customers": "Small businesses",
      "website": "https://payease.example",
      "location": "USA"
    }
  ]
}
```

The response contains ranked company results, scoring factors, explanations, and data-quality statistics.

The analysis API supports up to 2,000 target companies per request.

## Data Handling and Security

This project does not use a persistent database. Lead data is managed in browser memory and processed through the Node.js backend.

This approach keeps the prototype simple and avoids retaining uploaded company datasets on the server.

Website research is limited to publicly accessible pages. The backend includes URL validation and safeguards against requests to private or local network addresses.

The application does not access private SaaSquatch APIs, bypass CAPTCHAs, collect personal contact information, or automate outreach.

For production use, additional measures would be necessary, including authentication, rate limiting, persistent storage, monitoring, and more extensive validation.

## Performance and Deployment

CSV processing, deduplication, and scoring use lightweight JavaScript operations. Filtering already-loaded results happens in the browser without requiring a new analysis request.

There is no shared server-side cache. The application currently serves responses with a `no-store` cache policy.

The frontend and API are served from the same Node.js application, so separate frontend and backend deployments are not required.

The project can be deployed as a Node.js web service on a platform such as Render or Railway, or on a virtual machine.

The server uses the `PORT` environment variable for its listening port.

No public cloud deployment is included in this project.

## Testing

The application includes automated tests for scoring behavior, duplicate detection, missing information, evidence coverage, URL validation, and website research safety.

Run the tests with:

```bash
npm test
```

Latest local test result:

```text
Tests:   10
Passed:  10
Failed:  0
```

JavaScript syntax can also be checked using:

```bash
node --check server.js
node --check scoring.js
node --check websiteResearch.js
node --check public/app.js
```

The main dashboard workflow has also been manually exercised, including website research, lead addition, synergy analysis, CSV export, and clearing the lead list.

These checks cover the main functionality but do not guarantee that every external website or browser environment will behave identically.

## Design Decisions

I kept the project dependency-free because the main challenge was building a useful workflow, not setting up a large framework.

The interface uses a dark dashboard layout with separate sections for website research, company information, lead management, and analysis results.

The main design decisions were:

- Keep company research and analysis in one workspace.
- Make important actions easy to find.
- Show scoring explanations alongside results.
- Clearly identify missing or uncertain information.
- Allow users to export results without additional integrations.

I also chose rule-based scoring instead of generating scores through an AI model. This makes the scoring process deterministic and easier to inspect, test, and explain.

The relationship weights are illustrative and can be adjusted as more business evidence becomes available.

## Limitations

This is a working prototype rather than a production-ready lead intelligence platform.

Current limitations include:

- Website research depends on public page accessibility.
- Some websites block automated requests or rely on JavaScript-rendered content.
- Product and industry classifications are based on keywords.
- Company information is not independently verified.
- There is no persistent database or user authentication.
- Synergy scores do not establish actual acquisition suitability.
- The application does not integrate with SaaSquatch's internal systems.

Future improvements could include source-backed company enrichment, editable research profiles, database persistence, user accounts, CRM integration, and more detailed scoring evidence.

## Demo Walkthrough

The recommended 1–2 minute walkthrough covers:

1. The problem of prioritizing company leads.
2. Researching a company through its public website.
3. Adding the researched company to the lead list.
4. Comparing companies using the synergy scoring engine.
5. Reviewing score explanations and evidence coverage.
6. Filtering results and exporting the shortlist.
7. Explaining the technical approach and current limitations.

## Project Context

This project was developed for the Caprae Capital Full Stack Developer assessment after reviewing the accessible company discovery features of SaaSquatch Leads.

The main feature I focused on was helping users move from company discovery to lead prioritization. Website research supplies preliminary company information, while the scoring engine helps organize potential matches for further investigation.

The project is an independent assessment submission. It is not affiliated with, endorsed by, or integrated into SaaSquatch Leads.

---

**Project:** Caprae Capital Project — Business Synergy Finder  
**Role:** Full Stack Developer Assessment  
**Status:** Functional prototype
