// Minimal Freemius REST client.
// Re-implements the HMAC signature the legacy freemius-node-sdk uses, but
// with a sane fetch layer that actually returns responses on non-200 codes.
//
// Signature reference (from the SDK source):
//   string_to_sign = METHOD \n md5(body_json).hex \n CONTENT_TYPE \n DATE \n RESOURCE_URL
//   auth_header    = "FS {id}:{public_key}:{base64url(hex_signature)}"
//   where hex_signature = hmac_sha256(secret, string_to_sign).hex
//   and base64url is base64 of the hex-string bytes, with '=' stripped.

import crypto from "node:crypto";

const API_HOST = "api.freemius.com";
const API_VERSION = 1;

const SCOPE_BASE = {
    developer: (id) => `/developers/${id}`,
    plugin:    (id) => `/plugins/${id}`,
    user:      (id) => `/users/${id}`,
    store:     (id) => `/stores/${id}`,
    install:   (id) => `/installs/${id}`,
    app:       (id) => `/apps/${id}`,
};

function rfc2822(date) {
    // Match PHP's moment "ddd, DD MMM YYYY HH:mm:ss ZZ" with +0000 offset.
    const d = date.toUTCString(); // "Thu, 23 Apr 2026 20:51:15 GMT"
    // The server expects "+0000" not "GMT"; swap it.
    return d.replace(/ GMT$/, " +0000");
}

function base64UrlFromHex(hex) {
    // Freemius: Buffer.from(hex_string).toString('base64') then strip '='.
    return Buffer.from(hex, "utf8").toString("base64").replace(/=+$/g, "");
}

export function createClient({ scope, id, publicKey, secretKey }) {
    if (!SCOPE_BASE[scope]) throw new Error(`Unknown scope: ${scope}`);
    const base = SCOPE_BASE[scope](id);

    function resolvePath(path) {
        const trimmed = path.replace(/^\/+|\/+$/g, "");
        const [p, query = ""] = trimmed.split("?", 2);
        const withExt = p.endsWith(".json") ? p : `${p}.json`;
        return `/v${API_VERSION}${base}/${withExt}${query ? `?${query}` : ""}`;
    }

    async function call(method, path, body = null) {
        const resource = resolvePath(path);
        const [resourceNoQuery] = resource.split("?", 1);
        const isMutation = method === "POST" || method === "PUT";
        const jsonBody = body ? JSON.stringify(body) : "";
        const contentType = isMutation && jsonBody ? "application/json" : "";
        const contentMd5 = isMutation && jsonBody
            ? crypto.createHash("md5").update(jsonBody).digest("hex")
            : "";
        const date = rfc2822(new Date());

        const stringToSign = [method, contentMd5, contentType, date, resourceNoQuery].join("\n");
        const hex = crypto.createHmac("sha256", secretKey).update(stringToSign).digest("hex");
        const signature = base64UrlFromHex(hex);
        const authType = secretKey !== publicKey ? "FS" : "FSP";
        const authHeader = `${authType} ${id}:${publicKey}:${signature}`;

        const headers = { Authorization: authHeader, Date: date, Accept: "application/json" };
        if (contentType) {
            headers["Content-Type"] = contentType;
            headers["Content-MD5"] = contentMd5;
        }

        const url = `https://${API_HOST}${resource}`;
        const res = await fetch(url, {
            method,
            headers,
            body: jsonBody || undefined,
        });

        const rawText = await res.text();
        let parsed;
        try { parsed = rawText ? JSON.parse(rawText) : {}; } catch { parsed = { raw: rawText }; }

        return { status: res.status, ok: res.ok, data: parsed };
    }

    return {
        get:  (path)       => call("GET", path, null),
        post: (path, body) => call("POST", path, body),
        put:  (path, body) => call("PUT", path, body),
        del:  (path)       => call("DELETE", path, null),
    };
}
