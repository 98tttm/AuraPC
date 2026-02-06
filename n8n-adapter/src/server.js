require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, "workflows");
const MAP_PATH = path.join(ROOT, ".n8n-map.json");

function ensureDirs() {
    if (!fs.existsSync(WORKFLOWS_DIR)) fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
    if (!fs.existsSync(MAP_PATH)) fs.writeFileSync(MAP_PATH, JSON.stringify({}, null, 2), "utf-8");
}
ensureDirs();

function readMap() {
    try {
        return JSON.parse(fs.readFileSync(MAP_PATH, "utf-8"));
    } catch {
        return {};
    }
}

function writeMap(mapObj) {
    fs.writeFileSync(MAP_PATH, JSON.stringify(mapObj, null, 2), "utf-8");
}

function safeJoinWorkflows(relPath) {
    // chặn path traversal
    const full = path.resolve(WORKFLOWS_DIR, relPath);
    if (!full.startsWith(path.resolve(WORKFLOWS_DIR))) {
        throw new Error("Invalid path");
    }
    return full;
}
const app = express();
app.use(cors());
app.use(express.json());

const { N8N_BASE_URL, N8N_API_KEY, PORT = 8787 } = process.env;

if (!N8N_BASE_URL || !N8N_API_KEY) {
    console.error("Missing N8N_BASE_URL or N8N_API_KEY in .env");
    process.exit(1);
}

function n8nHeaders() {
    return {
        "Content-Type": "application/json",
        // n8n API key header (phổ biến)
        "X-N8N-API-KEY": N8N_API_KEY,
    };
}

/**
 * Helper gọi n8n API
 */
async function n8nFetch(path, options = {}) {
    const url = `${N8N_BASE_URL.replace(/\/$/, "")}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            ...n8nHeaders(),
            ...(options.headers || {}),
        },
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }

    if (!res.ok) {
        const msg = typeof data === "string" ? data : JSON.stringify(data);
        throw new Error(`n8n API error ${res.status}: ${msg}`);
    }
    return data;
}

/**
 * Health check
 */
app.get("/health", async (req, res) => {
    res.json({ ok: true, adapter: "n8n-adapter" });
});
/**
 * Who am I (debug API key identity)
 */
app.get("/whoami", async (req, res) => {
    const result = {
        ok: true,
        baseUrl: N8N_BASE_URL,
        auth: "apiKey",
        probes: {},
        user: null,
    };

    // Probe 1: workflows (guaranteed in your setup)
    try {
        const wf = await n8nFetch("/api/v1/workflows?limit=1", { method: "GET" });
        const first = wf?.data?.[0] || null;
        result.probes.workflows = {
            ok: true,
            endpoint: "/api/v1/workflows?limit=1",
            sample: first ? { id: first.id, name: first.name, active: first.active } : null,
        };
    } catch (err) {
        result.probes.workflows = { ok: false, error: err.message };
        return res.status(500).json(result);
    }

    // Probe 2: try user endpoints (optional)
    const attempts = [
        "/api/v1/users/me",
        "/api/v1/users",
        "/rest/users/me",
        "/rest/users",
    ];

    for (const path of attempts) {
        try {
            const data = await n8nFetch(path, { method: "GET" });

            // normalize possible shapes
            if (Array.isArray(data?.data) && data.data.length) {
                result.user = { source: path, sample: data.data[0] };
            } else if (Array.isArray(data) && data.length) {
                result.user = { source: path, sample: data[0] };
            } else {
                result.user = { source: path, sample: data };
            }

            result.probes.users = { ok: true, endpoint: path };
            break;
        } catch (err) {
            // keep trying
            result.probes.users = result.probes.users || { ok: false, tried: [] };
            result.probes.users.tried.push({ endpoint: path, error: err.message });
        }
    }

    return res.json(result);
});
app.get("/debug/n8n-version", async (req, res) => {
    try {
        const url = `${N8N_BASE_URL.replace(/\/$/, "")}/api/v1/workflows?limit=1`;
        const r = await fetch(url, { headers: n8nHeaders() });

        // lấy vài header hữu ích (có thể có cloudflare/nginx)
        const headers = {};
        ["server", "x-powered-by", "cf-ray", "cf-cache-status", "date"].forEach((k) => {
            const v = r.headers.get(k);
            if (v) headers[k] = v;
        });

        const text = await r.text();
        let body;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }

        res.json({
            ok: r.ok,
            status: r.status,
            endpoint: "/api/v1/workflows?limit=1",
            headers,
            sample: body?.data?.[0] ? { id: body.data[0].id, name: body.data[0].name } : null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
/**
 * List workflows
 */
app.get("/workflows", async (req, res) => {
    try {
        // Endpoint phổ biến của n8n cho workflows
        const data = await n8nFetch("/api/v1/workflows", { method: "GET" });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get workflow by id
 */
app.get("/workflows/:id", async (req, res) => {
    try {
        const data = await n8nFetch(`/api/v1/workflows/${req.params.id}`, {
            method: "GET",
        });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`n8n-adapter running on http://localhost:${PORT}`);
});
/**
 * Pull a workflow from n8n and save to workflows/<collection>/<slug>.json
 * body: { id: string, filePath: string }
 */
app.post("/sync/pull", async (req, res) => {
    try {
        const { id, filePath } = req.body || {};
        if (!id || !filePath) {
            return res.status(400).json({ error: "Missing id or filePath" });
        }

        const wf = await n8nFetch(`/api/v1/workflows/${id}`, { method: "GET" });

        const outPath = safeJoinWorkflows(filePath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify(wf, null, 2), "utf-8");

        const map = readMap();
        map[filePath] = { id: wf.id, name: wf.name, active: wf.active, updatedAt: wf.updatedAt };
        writeMap(map);

        res.json({ ok: true, savedTo: outPath, mapEntry: map[filePath] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});