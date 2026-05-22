const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "jbot2026";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ elections: [] }, null, 2));
  }
}

function readState() {
  ensureDataFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (!parsed || !Array.isArray(parsed.elections)) return { elections: [] };
    return parsed;
  } catch {
    return { elections: [] };
  }
}

function writeState(state) {
  ensureDataFile();
  const safeState = state && Array.isArray(state.elections) ? state : { elections: [] };
  fs.writeFileSync(STATE_FILE, JSON.stringify(safeState, null, 2));
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body ? JSON.parse(body) : {};
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || "").trim()).digest("hex");
}

function isOpen(election) {
  const now = Date.now();
  return now >= parseKoreaDateTime(election.startAt).getTime() && now <= parseKoreaDateTime(election.endAt).getTime();
}

function parseKoreaDateTime(value) {
  if (!value || value.includes("Z") || /[+-]\d\d:\d\d$/.test(value)) return new Date(value);
  return new Date(`${value}:00+09:00`);
}

function makePublicElection(election) {
  return {
    id: election.id,
    title: election.title,
    startAt: election.startAt,
    endAt: election.endAt,
    identityMode: election.identityMode,
    repeatMode: election.repeatMode,
    sections: election.sections || []
  };
}

function requireAdmin(req, res) {
  const supplied = req.headers["x-admin-password"];
  if (supplied !== ADMIN_PASSWORD) {
    json(res, 401, { ok: false, error: "admin auth required" });
    return false;
  }
  return true;
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    send(res, 200, file, MIME[ext] || "application/octet-stream");
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const state = readState();

  if (url.pathname === "/api/public/elections" && req.method === "GET") {
    json(res, 200, {
      elections: state.elections.filter(isOpen).map(makePublicElection)
    });
    return;
  }

  if (url.pathname === "/api/admin/login" && req.method === "POST") {
    const body = await readJson(req);
    json(res, body.password === ADMIN_PASSWORD ? 200 : 401, { ok: body.password === ADMIN_PASSWORD });
    return;
  }

  if (url.pathname === "/api/admin/state" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    json(res, 200, state);
    return;
  }

  if (url.pathname === "/api/admin/state" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const body = await readJson(req);
    writeState(body);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/admin/election" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const election = await readJson(req);
    if (!election.id || !election.title || !Array.isArray(election.sections)) {
      json(res, 400, { ok: false, error: "invalid election" });
      return;
    }
    state.elections.unshift({ ...election, ballots: [] });
    writeState(state);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/admin/election/") && req.method === "PUT") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const index = state.elections.findIndex((election) => election.id === id);
    if (index === -1) return json(res, 404, { ok: false, error: "not found" });
    if ((state.elections[index].ballots || []).length > 0) {
      return json(res, 409, { ok: false, error: "election already has ballots" });
    }
    const election = await readJson(req);
    state.elections[index] = { ...election, id, ballots: [] };
    writeState(state);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/admin/election/") && req.method === "DELETE") {
    if (!requireAdmin(req, res)) return;
    const id = decodeURIComponent(url.pathname.split("/").pop());
    state.elections = state.elections.filter((election) => election.id !== id);
    writeState(state);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/public/election/") && req.method === "POST") {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const election = state.elections.find((item) => item.id === id);
    if (!election) return json(res, 404, { ok: false, error: "not found" });
    if (!isOpen(election)) return json(res, 409, { ok: false, error: "closed" });

    const body = await readJson(req);
    if (election.repeatMode === "blocked") {
      const tokenRecord = (election.tokens || []).find((token) => token.hash === hashText(body.token));
      if (!tokenRecord) return json(res, 403, { ok: false, error: "invalid token" });
      if (tokenRecord.used) return json(res, 409, { ok: false, error: "used token" });
      tokenRecord.used = true;
      tokenRecord.usedAt = new Date().toISOString();
    }

    const answers = Array.isArray(body.answers) ? body.answers : [];
    for (const section of election.sections || []) {
      const answer = answers.find((item) => item.sectionId === section.id);
      if (!answer || !Array.isArray(answer.choices) || answer.choices.length === 0) {
        return json(res, 400, { ok: false, error: "missing answer" });
      }
      if (!section.multiple && answer.choices.length > 1) {
        return json(res, 400, { ok: false, error: "too many choices" });
      }
      const maxChoices = section.multiple ? Number(section.maxChoices || section.choices.length) : 1;
      if ((section.choiceLimitMode || "max") === "exact" && answer.choices.length !== maxChoices) {
        return json(res, 400, { ok: false, error: "wrong choice count" });
      }
      if ((section.choiceLimitMode || "max") === "max" && answer.choices.length > maxChoices) {
        return json(res, 400, { ok: false, error: "too many choices" });
      }
      const allowed = new Set(section.choices || []);
      if (answer.choices.some((choice) => !allowed.has(choice))) {
        return json(res, 400, { ok: false, error: "invalid choice" });
      }
    }

    election.ballots = election.ballots || [];
    election.ballots.push({
      id: `ballot_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
      submittedAt: new Date().toISOString(),
      voterName: election.identityMode === "named" ? String(body.voterName || "").trim() : "",
      answers
    });
    writeState(state);
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { ok: false, error: "unknown api" });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(() => {
    json(res, 500, { ok: false, error: "server error" });
  });
});

async function handleRequest(req, res) {
  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }
  serveFile(req, res);
}

server.listen(PORT, () => {
  console.log(`JBOT vote server running at http://localhost:${PORT}`);
});
