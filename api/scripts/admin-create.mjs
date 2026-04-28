#!/usr/bin/env node
/**
 * Admin bootstrap CLI.
 *
 *   cd api && node scripts/admin-create.mjs
 *
 * Interactive: prompts email, name, password (twice, hidden), creates
 * the admin_users row, generates a TOTP secret + 8 backup codes, and
 * prints the otpauth:// URI exactly once. Add it to your authenticator
 * app immediately — the secret is never displayed again.
 *
 * Backup codes are also shown once; copy them somewhere safe. We only
 * store sha256(code), so a lost backup code is gone for good.
 *
 * Required env: DATABASE_URL, ADMIN_TOTP_KEY (≥16 chars).
 */

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    createCipheriv, createHash, randomBytes,
} from "node:crypto";
import pg from "pg";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";

// ─── Tiny .env loader ───────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
function loadEnv(file) {
    try {
        for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            let v = line.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch { /* env from shell */ }
}
loadEnv(path.join(apiRoot, ".env"));

if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL.");
    process.exit(1);
}
if (!process.env.ADMIN_TOTP_KEY || process.env.ADMIN_TOTP_KEY.length < 16) {
    console.error("Missing or too short ADMIN_TOTP_KEY (need ≥16 chars). Generate one with:");
    console.error("  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
}

// ─── Prompt helpers ─────────────────────────────────────────────────
const rl = createInterface({ input: stdin, output: stdout, terminal: true });
function ask(prompt) {
    return new Promise((res) => rl.question(prompt, (a) => res(a.trim())));
}
function askHidden(prompt) {
    return new Promise((res) => {
        stdout.write(prompt);
        const onData = (char) => {
            const c = char.toString();
            if (c === "\n" || c === "\r" || c === "\r\n") {
                stdin.removeListener("data", onData);
                stdin.setRawMode(false);
                stdin.pause();
                stdout.write("\n");
                res(buf);
            } else if (c === "") {
                process.exit(1);
            } else if (c === "" || c === "\b") {
                if (buf.length > 0) buf = buf.slice(0, -1);
            } else {
                buf += c;
            }
        };
        let buf = "";
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
    });
}

// ─── Crypto (mirrors src/lib/admin-crypto.ts) ───────────────────────
function loadKey() {
    return createHash("sha256").update(process.env.ADMIN_TOTP_KEY, "utf8").digest();
}
function encryptSecret(plaintext) {
    const key = loadKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, tag]);
}
function generateBackupCodes(n = 8) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const codes = [];
    for (let i = 0; i < n; i++) {
        const buf = randomBytes(8);
        let s = "";
        for (let j = 0; j < 8; j++) s += alphabet[buf[j] % alphabet.length];
        codes.push(`${s.slice(0, 4)}-${s.slice(4)}`);
    }
    return codes;
}
function hashBackupCode(code) {
    const norm = code.replace(/[-\s]/g, "").toUpperCase();
    return createHash("sha256").update(norm).digest();
}

// ─── Main ───────────────────────────────────────────────────────────
const email = (await ask("Email: ")).toLowerCase();
if (!/^.+@.+\..+$/.test(email)) {
    console.error("Invalid email."); process.exit(1);
}
const name = await ask("Name: ");
if (!name) { console.error("Name required."); process.exit(1); }
const role = (await ask("Role [owner/staff/readonly] (owner): ")) || "owner";
if (!["owner", "staff", "readonly"].includes(role)) {
    console.error("Invalid role."); process.exit(1);
}
const password = await askHidden("Password (≥12 chars): ");
if (password.length < 12) { console.error("Password too short."); process.exit(1); }
const confirm = await askHidden("Confirm password: ");
if (password !== confirm) { console.error("Passwords don't match."); process.exit(1); }

rl.close();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

try {
    const { rows: existing } = await pool.query(
        `SELECT id FROM admin_users WHERE email = $1`,
        [email],
    );
    if (existing.length > 0) {
        console.error(`✗ Admin ${email} already exists.`);
        process.exit(1);
    }

    console.log("\n→ Hashing password (argon2id, ~200ms)…");
    const hash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 4,
    });

    console.log("→ Generating TOTP secret + 8 backup codes…");
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const enc = encryptSecret(secret);
    const codes = generateBackupCodes(8);
    const codeHashes = codes.map(hashBackupCode);

    const totp = new OTPAuth.TOTP({
        issuer: "Tempaloo Admin",
        label: email,
        secret: OTPAuth.Secret.fromBase32(secret),
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });
    const otpauthUri = totp.toString();

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `INSERT INTO admin_users
                (email, name, password_hash, totp_secret_enc, totp_enabled, role)
             VALUES ($1, $2, $3, $4, TRUE, $5)
             RETURNING id`,
            [email, name, hash, enc, role],
        );
        const adminId = rows[0].id;
        for (const ch of codeHashes) {
            await client.query(
                `INSERT INTO admin_backup_codes (admin_user_id, code_hash) VALUES ($1, $2)`,
                [adminId, ch],
            );
        }
        await client.query("COMMIT");
        console.log(`\n✓ Admin created — id = ${adminId}\n`);
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }

    // ─── One-time output ────────────────────────────────────────────
    console.log("─".repeat(60));
    console.log("STEP 1 — Add to your authenticator app NOW:");
    console.log("─".repeat(60));
    console.log(`Issuer:  Tempaloo Admin`);
    console.log(`Account: ${email}`);
    console.log(`Secret:  ${secret}`);
    console.log(`URI:     ${otpauthUri}`);
    console.log("\nPaste the URI into a QR generator (e.g. qrencode -o qr.png) or");
    console.log("type the secret manually into Aegis / 1Password / Google Auth.\n");

    console.log("─".repeat(60));
    console.log("STEP 2 — Save these 8 backup codes (each works once):");
    console.log("─".repeat(60));
    for (const c of codes) console.log(`  ${c}`);
    console.log("\nThese will NEVER be shown again. Store them in a password manager.\n");

    console.log("✓ Done. Sign in at /admin/login.");
} finally {
    await pool.end();
}
