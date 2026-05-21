const express = require("express");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3010;
const DEFAULT_PROPOSALS_DIR = path.join(__dirname, "proposals");
const ASSETS_DIR = path.join(__dirname, "assets");

const defaultFormValues = {
  clientName: "",
  projectTitle: "",
  preparedBy: "NixAI Labs",
  preparedDate: new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date()),
  summary: "",
  scopeItems: "",
  investmentItems: "Discovery & Strategy | $2,500\nDesign & Build | $12,000\nLaunch Support | $2,500",
  total: "",
  timelineItems: "Discovery and proposal alignment\nDesign and implementation\nQA, launch, and handover",
  contactEmail: "hello@nixailabs.co",
  notes: "",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function routeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
}

function parseList(value) {
  return String(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseInvestmentItems(value) {
  return parseList(value).map((line) => {
    const parts = line.split("|");
    const item = parts.shift()?.trim();
    const cost = parts.join("|").trim();

    if (!item || !cost) {
      throw new Error("Each investment line must use the format: Item | Cost.");
    }

    return { item, cost };
  });
}

function readProposalFiles(proposalsDir) {
  if (!fs.existsSync(proposalsDir)) {
    return [];
  }

  return fs
    .readdirSync(proposalsDir)
    .filter((fileName) => fileName.endsWith(".html"))
    .sort()
    .map((fileName) => ({
      slug: fileName.replace(/\.html$/, ""),
      fileName,
    }));
}

function pageShell({ title, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #172033; }
    a { color: inherit; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
    .hero { background: #111827; color: #fff; border-radius: 24px; padding: 40px; box-shadow: 0 20px 70px rgba(17, 24, 39, 0.18); }
    .hero p { margin: 10px 0 0; color: #cbd5e1; line-height: 1.7; }
    .hero-actions { margin-top: 26px; display: flex; gap: 12px; flex-wrap: wrap; }
    .button, button { display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: #2563eb; color: #fff; font-weight: 700; padding: 12px 20px; text-decoration: none; cursor: pointer; }
    .button.secondary { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.18); }
    .card { margin-top: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 26px; box-shadow: 0 10px 35px rgba(15, 23, 42, 0.06); }
    .proposal-list { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 10px; }
    .proposal-list a { display: flex; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid #e5e7eb; border-radius: 14px; text-decoration: none; background: #f8fafc; }
    form { display: grid; gap: 18px; }
    label { display: grid; gap: 8px; font-weight: 700; color: #243044; }
    input, textarea { width: 100%; border: 1px solid #d5dbea; border-radius: 14px; padding: 13px 14px; font: inherit; color: #172033; background: #fff; }
    textarea { min-height: 112px; resize: vertical; line-height: 1.6; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .hint { color: #64748b; font-size: 0.9rem; font-weight: 500; }
    .errors { background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239; border-radius: 16px; padding: 16px 18px; }
    .empty { color: #64748b; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } .hero { padding: 30px 24px; } }
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
</body>
</html>`;
}

function renderHome(proposalsDir) {
  const proposals = readProposalFiles(proposalsDir);
  const list = proposals.length
    ? `<ul class="proposal-list">${proposals
        .map(
          ({ slug }) =>
            `<li><a href="/v1/${encodeURIComponent(slug)}"><span>${escapeHtml(
              slug,
            )}</span><strong>Open</strong></a></li>`,
        )
        .join("")}</ul>`
    : `<p class="empty">No proposals have been created yet.</p>`;

  return pageShell({
    title: "Proposals",
    body: `<section class="hero">
      <h1>Proposal workspace</h1>
      <p>Create a polished proposal page, save it as a static HTML file, and share it through the existing /v1/client-name URL.</p>
      <div class="hero-actions">
        <a class="button" href="/new">Create new proposal</a>
      </div>
    </section>
    <section class="card">
      <h2>Published proposals</h2>
      ${list}
    </section>`,
  });
}

function renderCreateForm({ values = defaultFormValues, errors = [] } = {}) {
  const fieldValue = (name) => escapeHtml(values[name] ?? defaultFormValues[name] ?? "");
  const errorMarkup = errors.length
    ? `<div class="errors"><strong>Please fix the following:</strong><ul>${errors
        .map((error) => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul></div>`
    : "";

  return pageShell({
    title: "Create Proposal",
    body: `<section class="hero">
      <h1>Create a new proposal</h1>
      <p>Fill in the proposal details below. The server will generate a shareable page under /v1/client-name.</p>
      <div class="hero-actions">
        <a class="button secondary" href="/">Back to proposals</a>
      </div>
    </section>
    <section class="card">
      ${errorMarkup}
      <form method="post" action="/proposals">
        <div class="grid">
          <label>Client name
            <input name="clientName" value="${fieldValue("clientName")}" required>
          </label>
          <label>Project title
            <input name="projectTitle" value="${fieldValue("projectTitle")}" placeholder="Digital Transformation Proposal" required>
          </label>
        </div>
        <div class="grid">
          <label>Prepared by
            <input name="preparedBy" value="${fieldValue("preparedBy")}" required>
          </label>
          <label>Prepared date
            <input name="preparedDate" value="${fieldValue("preparedDate")}" required>
          </label>
        </div>
        <label>Executive summary
          <textarea name="summary" required>${fieldValue("summary")}</textarea>
        </label>
        <label>Scope of work
          <span class="hint">Add one scope item per line.</span>
          <textarea name="scopeItems" required>${fieldValue("scopeItems")}</textarea>
        </label>
        <label>Investment items
          <span class="hint">Use one line per item with the format: Item | Cost.</span>
          <textarea name="investmentItems" required>${fieldValue("investmentItems")}</textarea>
        </label>
        <div class="grid">
          <label>Total investment
            <input name="total" value="${fieldValue("total")}" placeholder="$17,000" required>
          </label>
          <label>Contact email
            <input type="email" name="contactEmail" value="${fieldValue("contactEmail")}" required>
          </label>
        </div>
        <label>Timeline
          <span class="hint">Add one milestone per line.</span>
          <textarea name="timelineItems">${fieldValue("timelineItems")}</textarea>
        </label>
        <label>Notes
          <textarea name="notes">${fieldValue("notes")}</textarea>
        </label>
        <button type="submit">Create proposal</button>
      </form>
    </section>`,
  });
}

function normalizeForm(body) {
  return {
    ...defaultFormValues,
    clientName: String(body.clientName || "").trim(),
    projectTitle: String(body.projectTitle || "").trim(),
    preparedBy: String(body.preparedBy || "").trim() || defaultFormValues.preparedBy,
    preparedDate: String(body.preparedDate || "").trim() || defaultFormValues.preparedDate,
    summary: String(body.summary || "").trim(),
    scopeItems: String(body.scopeItems || "").trim(),
    investmentItems: String(body.investmentItems || "").trim(),
    total: String(body.total || "").trim(),
    timelineItems: String(body.timelineItems || "").trim(),
    contactEmail: String(body.contactEmail || "").trim() || defaultFormValues.contactEmail,
    notes: String(body.notes || "").trim(),
  };
}

function validateProposal(values) {
  const errors = [];
  const slug = slugify(values.clientName);
  const scopeItems = parseList(values.scopeItems);
  const timelineItems = parseList(values.timelineItems);
  let investmentItems = [];

  if (!values.clientName) errors.push("Client name is required.");
  if (!slug) errors.push("Client name must include letters or numbers.");
  if (!values.projectTitle) errors.push("Project title is required.");
  if (!values.summary) errors.push("Executive summary is required.");
  if (!scopeItems.length) errors.push("Add at least one scope item.");
  if (!values.total) errors.push("Total investment is required.");

  try {
    investmentItems = parseInvestmentItems(values.investmentItems);
  } catch (error) {
    errors.push(error.message);
  }

  if (!investmentItems.length) {
    errors.push("Add at least one investment item.");
  }

  return { errors, slug, scopeItems, investmentItems, timelineItems };
}

function renderProposalHtml(proposal) {
  const scope = proposal.scopeItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const investmentRows = proposal.investmentItems
    .map(
      ({ item, cost }) =>
        `<tr><td>${escapeHtml(item)}</td><td>${escapeHtml(cost)}</td></tr>`,
    )
    .join("");
  const timeline = proposal.timelineItems.length
    ? `<section class="section">
      <h2>Timeline</h2>
      <ol>${proposal.timelineItems
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("")}</ol>
    </section>`
    : "";
  const notes = proposal.notes
    ? `<section class="section">
      <h2>Notes</h2>
      <p>${escapeHtml(proposal.notes)}</p>
    </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(proposal.clientName)} - ${escapeHtml(proposal.projectTitle)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #eef2f7; color: #1f2937; line-height: 1.7; }
    header { background: linear-gradient(135deg, #101827, #1d4ed8); color: #fff; padding: 64px 40px; }
    header .eyebrow { color: #bfdbfe; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
    header h1 { font-size: clamp(2.5rem, 7vw, 5.8rem); line-height: 0.95; margin-top: 16px; max-width: 980px; }
    header p { color: #dbeafe; margin-top: 18px; font-size: 1.05rem; }
    main { max-width: 940px; margin: -34px auto 48px; padding: 0 24px; }
    .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 24px; padding: 34px; margin-bottom: 22px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
    .section h2 { color: #1d4ed8; font-size: 1.15rem; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 16px; }
    ul, ol { padding-left: 24px; }
    li { margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 16px; }
    th, td { padding: 14px 16px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #eff6ff; color: #1d4ed8; }
    tr.total td { font-weight: 800; color: #111827; background: #f8fafc; }
    .cta { text-align: center; padding: 36px 24px; }
    .cta a { display: inline-block; border-radius: 999px; background: #2563eb; color: #fff; font-weight: 800; padding: 14px 28px; text-decoration: none; }
    footer { text-align: center; color: #64748b; padding: 28px; font-size: 0.9rem; }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Digital Proposal</div>
    <h1>${escapeHtml(proposal.clientName)}</h1>
    <p>${escapeHtml(proposal.projectTitle)} prepared by ${escapeHtml(proposal.preparedBy)} - ${escapeHtml(proposal.preparedDate)}</p>
  </header>
  <main>
    <section class="section">
      <h2>Executive Summary</h2>
      <p>${escapeHtml(proposal.summary)}</p>
    </section>
    <section class="section">
      <h2>Scope of Work</h2>
      <ul>${scope}</ul>
    </section>
    ${timeline}
    <section class="section">
      <h2>Investment</h2>
      <table>
        <thead><tr><th>Item</th><th>Cost</th></tr></thead>
        <tbody>
          ${investmentRows}
          <tr class="total"><td>Total</td><td>${escapeHtml(proposal.total)}</td></tr>
        </tbody>
      </table>
    </section>
    ${notes}
    <div class="cta">
      <a href="mailto:${escapeHtml(proposal.contactEmail)}">Accept Proposal</a>
    </div>
  </main>
  <footer>This proposal is confidential and prepared exclusively for ${escapeHtml(proposal.clientName)}.</footer>
</body>
</html>`;
}

function createApp({ proposalsDir = DEFAULT_PROPOSALS_DIR } = {}) {
  const app = express();

  app.use("/assets", express.static(ASSETS_DIR));
  app.use(express.urlencoded({ extended: false }));

  app.get("/", (req, res) => {
    res.send(renderHome(proposalsDir));
  });

  app.get("/new", (req, res) => {
    res.send(renderCreateForm());
  });

  app.post("/proposals", async (req, res, next) => {
    const values = normalizeForm(req.body);
    const validation = validateProposal(values);

    if (validation.errors.length) {
      return res.status(422).send(renderCreateForm({ values, errors: validation.errors }));
    }

    const filePath = path.join(proposalsDir, `${validation.slug}.html`);
    const html = renderProposalHtml({
      ...values,
      scopeItems: validation.scopeItems,
      investmentItems: validation.investmentItems,
      timelineItems: validation.timelineItems,
    });

    try {
      await fs.promises.mkdir(proposalsDir, { recursive: true });
      await fs.promises.writeFile(filePath, html, { flag: "wx" });
      res.redirect(303, `/v1/${validation.slug}`);
    } catch (error) {
      if (error.code === "EEXIST") {
        return res.status(409).send(
          renderCreateForm({
            values,
            errors: [`A proposal already exists for ${values.clientName}.`],
          }),
        );
      }
      next(error);
    }
  });

  app.get("/v1/:clientName", (req, res) => {
    const clientName = routeSlug(req.params.clientName);

    if (!clientName) {
      return res.status(400).send("Invalid client name.");
    }

    const filePath = path.join(proposalsDir, `${clientName}.html`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Proposal Not Found</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;">
            <h2>Proposal not found</h2>
            <p>No proposal exists for <strong>${escapeHtml(clientName)}</strong>.</p>
          </body>
        </html>
      `);
    }

    res.sendFile(filePath);
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => {
    console.log(`Proposals server running on port ${PORT}`);
  });
}

module.exports = {
  createApp,
  escapeHtml,
  parseInvestmentItems,
  renderProposalHtml,
  slugify,
  validateProposal,
};
