const crypto = require("crypto");

const STATE_ID = "jbot_vote";
const DEFAULT_STATE = { elections: [] };

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function getEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD || "jbot2026";
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceKey,
    adminPassword
  };
}

function supabaseHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function readState() {
  const { supabaseUrl, serviceKey } = getEnv();
  const response = await fetch(`${supabaseUrl}/rest/v1/app_state?id=eq.${STATE_ID}&select=state&limit=1`, {
    headers: supabaseHeaders(serviceKey)
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${response.status}`);
  const rows = await response.json();
  const state = rows[0]?.state || DEFAULT_STATE;
  return state && Array.isArray(state.elections) ? state : DEFAULT_STATE;
}

async function writeState(state) {
  const { supabaseUrl, serviceKey } = getEnv();
  const safeState = state && Array.isArray(state.elections) ? state : DEFAULT_STATE;
  const response = await fetch(`${supabaseUrl}/rest/v1/app_state`, {
    method: "POST",
    headers: supabaseHeaders(serviceKey, { Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ id: STATE_ID, state: safeState })
  });
  if (!response.ok) throw new Error(`Supabase write failed: ${response.status}`);
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || "").trim()).digest("hex");
}

function isOpen(election) {
  const now = Date.now();
  return now >= new Date(election.startAt).getTime() && now <= new Date(election.endAt).getTime();
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

function normalizePath(event) {
  const raw = event.path || "";
  return raw
    .replace(/^\/\.netlify\/functions\/api/, "/api")
    .replace(/^\/api\/?/, "/api/");
}

function requireAdmin(event) {
  const { adminPassword } = getEnv();
  const headers = event.headers || {};
  const supplied = headers["x-admin-password"] || headers["X-Admin-Password"];
  return supplied === adminPassword;
}

function parseBody(event) {
  if (!event.body) return {};
  return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body);
}

exports.handler = async (event) => {
  try {
    const path = normalizePath(event);
    const method = event.httpMethod;

    if (path === "/api/public/elections" && method === "GET") {
      const state = await readState();
      return json(200, { elections: state.elections.filter(isOpen).map(makePublicElection) });
    }

    if (path === "/api/admin/login" && method === "POST") {
      const body = parseBody(event);
      const { adminPassword } = getEnv();
      return body.password === adminPassword ? json(200, { ok: true }) : json(401, { ok: false });
    }

    if (path === "/api/admin/state" && method === "GET") {
      if (!requireAdmin(event)) return json(401, { ok: false, error: "admin auth required" });
      return json(200, await readState());
    }

    if (path === "/api/admin/state" && method === "POST") {
      if (!requireAdmin(event)) return json(401, { ok: false, error: "admin auth required" });
      await writeState(parseBody(event));
      return json(200, { ok: true });
    }

    if (path === "/api/admin/election" && method === "POST") {
      if (!requireAdmin(event)) return json(401, { ok: false, error: "admin auth required" });
      const state = await readState();
      const election = parseBody(event);
      if (!election.id || !election.title || !Array.isArray(election.sections)) {
        return json(400, { ok: false, error: "invalid election" });
      }
      state.elections.unshift({ ...election, ballots: [] });
      await writeState(state);
      return json(200, { ok: true });
    }

    if (path.startsWith("/api/admin/election/") && method === "PUT") {
      if (!requireAdmin(event)) return json(401, { ok: false, error: "admin auth required" });
      const state = await readState();
      const id = decodeURIComponent(path.split("/").pop());
      const index = state.elections.findIndex((election) => election.id === id);
      if (index === -1) return json(404, { ok: false, error: "not found" });
      if ((state.elections[index].ballots || []).length > 0) {
        return json(409, { ok: false, error: "election already has ballots" });
      }
      const election = parseBody(event);
      state.elections[index] = { ...election, id, ballots: [] };
      await writeState(state);
      return json(200, { ok: true });
    }

    if (path.startsWith("/api/admin/election/") && method === "DELETE") {
      if (!requireAdmin(event)) return json(401, { ok: false, error: "admin auth required" });
      const state = await readState();
      const id = decodeURIComponent(path.split("/").pop());
      state.elections = state.elections.filter((election) => election.id !== id);
      await writeState(state);
      return json(200, { ok: true });
    }

    if (path.startsWith("/api/public/election/") && method === "POST") {
      const state = await readState();
      const id = decodeURIComponent(path.split("/").pop());
      const election = state.elections.find((item) => item.id === id);
      if (!election) return json(404, { ok: false, error: "not found" });
      if (!isOpen(election)) return json(409, { ok: false, error: "closed" });

      const body = parseBody(event);
      if (election.repeatMode === "blocked") {
        const tokenRecord = (election.tokens || []).find((token) => token.hash === hashText(body.token));
        if (!tokenRecord) return json(403, { ok: false, error: "invalid token" });
        if (tokenRecord.used) return json(409, { ok: false, error: "used token" });
        tokenRecord.used = true;
        tokenRecord.usedAt = new Date().toISOString();
      }

      const answers = Array.isArray(body.answers) ? body.answers : [];
      for (const section of election.sections || []) {
        const answer = answers.find((item) => item.sectionId === section.id);
        if (!answer || !Array.isArray(answer.choices) || answer.choices.length === 0) {
          return json(400, { ok: false, error: "missing answer" });
        }
        if (!section.multiple && answer.choices.length > 1) {
          return json(400, { ok: false, error: "too many choices" });
        }
        const allowed = new Set(section.choices || []);
        if (answer.choices.some((choice) => !allowed.has(choice))) {
          return json(400, { ok: false, error: "invalid choice" });
        }
      }

      election.ballots = election.ballots || [];
      election.ballots.push({
        id: `ballot_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
        submittedAt: new Date().toISOString(),
        voterName: election.identityMode === "named" ? String(body.voterName || "").trim() : "",
        answers
      });
      await writeState(state);
      return json(200, { ok: true });
    }

    return json(404, { ok: false, error: "unknown api" });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: "server error" });
  }
};
