const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createApp, parseInvestmentItems, slugify } = require("../server");

function formBody(overrides = {}) {
  return new URLSearchParams({
    clientName: "Acme & Sons",
    projectTitle: "Operations Automation Proposal",
    preparedBy: "NixAI Labs",
    preparedDate: "May 2026",
    summary: "A focused proposal for automating manual reporting and intake.",
    scopeItems: "Discovery\nWorkflow build\nLaunch support",
    investmentItems: "Discovery | $2,000\nBuild | $8,000",
    total: "$10,000",
    timelineItems: "Discovery\nBuild\nLaunch",
    contactEmail: "hello@nixailabs.co",
    notes: "Valid for 30 days.",
    ...overrides,
  });
}

async function withServer(callback) {
  const proposalsDir = fs.mkdtempSync(path.join(os.tmpdir(), "proposals-test-"));
  const server = createApp({ proposalsDir }).listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    await callback({ baseUrl: `http://127.0.0.1:${port}`, proposalsDir });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    fs.rmSync(proposalsDir, { recursive: true, force: true });
  }
}

test("slugify creates share-safe proposal slugs", () => {
  assert.equal(slugify("Acme & Sons! 2026"), "acme-and-sons-2026");
  assert.equal(slugify("../"), "");
});

test("parseInvestmentItems requires item and cost separators", () => {
  assert.deepEqual(parseInvestmentItems("Design | $1,000"), [
    { item: "Design", cost: "$1,000" },
  ]);
  assert.throws(
    () => parseInvestmentItems("Design only"),
    /Each investment line must use the format/,
  );
});

test("POST /proposals creates a static proposal and redirects to it", async () => {
  await withServer(async ({ baseUrl, proposalsDir }) => {
    const response = await fetch(`${baseUrl}/proposals`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody(),
      redirect: "manual",
    });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/v1/acme-and-sons");

    const filePath = path.join(proposalsDir, "acme-and-sons.html");
    assert.equal(fs.existsSync(filePath), true);

    const page = await fetch(`${baseUrl}/v1/acme-and-sons`);
    const html = await page.text();

    assert.equal(page.status, 200);
    assert.match(html, /Operations Automation Proposal/);
    assert.match(html, /Discovery/);
    assert.match(html, /\$10,000/);
  });
});

test("POST /proposals returns validation errors without writing a file", async () => {
  await withServer(async ({ baseUrl, proposalsDir }) => {
    const response = await fetch(`${baseUrl}/proposals`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: formBody({
        clientName: "../",
        investmentItems: "Build only",
      }),
    });
    const html = await response.text();

    assert.equal(response.status, 422);
    assert.match(html, /Client name must include letters or numbers/);
    assert.match(html, /Each investment line must use the format/);
    assert.deepEqual(fs.readdirSync(proposalsDir), []);
  });
});
