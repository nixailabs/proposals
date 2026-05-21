const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3010;
const PROPOSALS_DIR = path.join(__dirname, "proposals");

app.use("/assets", express.static(path.join(__dirname, "assets")));

app.get("/v1/:clientName", (req, res) => {
  const clientName = req.params.clientName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");

  if (!clientName) {
    return res.status(400).send("Invalid client name.");
  }

  const filePath = path.join(PROPOSALS_DIR, `${clientName}.html`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Proposal Not Found</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2>Proposal not found</h2>
          <p>No proposal exists for <strong>${clientName}</strong>.</p>
        </body>
      </html>
    `);
  }

  res.sendFile(filePath);
});

app.get("/", (req, res) => {
  res.send("Proposals server is running.");
});

app.listen(PORT, () => {
  console.log(`Proposals server running on port ${PORT}`);
});
