import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, EmptyRow, Pill } from "@/components/admin/Shell";
import { relTime } from "@/lib/admin/format";
import { BlockButton, UnblockButton } from "@/components/admin/AbuseActions";

export const dynamic = "force-dynamic";

interface AbuseResp {
    blocked: Array<{
        id: string; license_key: string;
        blocked_at: string; blocked_reason: string | null;
        email: string; plan_name: string;
        blocked_by_email: string | null;
    }>;
    ipFlag: Array<{
        id: string; license_key: string;
        email: string; plan_name: string;
        distinct_ips_24h: string;
        ip_samples: string[] | null;
    }>;
    siteFlag: Array<{
        id: string; license_key: string;
        email: string; plan_name: string;
        distinct_hosts_30d: string;
        max_sites: number;
    }>;
}

export default async function AbusePage() {
    const data = await adminGet<AbuseResp>("/admin/abuse");

    return (
        <>
            <PageHeader
                eyebrow="ABUSE · TRIAGE"
                title="Suspected abuse"
                subtitle="Heuristic flags for licenses likely shared / re-distributed. Review evidence, block if confirmed."
            />

            {/* ─── Currently blocked ─────────────────────────── */}
            <section style={{ marginBottom: 28 }}>
                <h2 style={sectionH}>Currently blocked ({data.blocked.length})</h2>
                <Table>
                    <thead>
                        <tr>
                            <Th>Email</Th>
                            <Th w={120}>Plan</Th>
                            <Th w={140}>Blocked</Th>
                            <Th w={180}>By admin</Th>
                            <Th>Reason</Th>
                            <Th w={140}>Action</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.blocked.length === 0 ? <EmptyRow colSpan={6}>No blocked licenses.</EmptyRow> :
                            data.blocked.map((r) => (
                                <tr key={r.id}>
                                    <Td>{r.email}</Td>
                                    <Td dim>{r.plan_name}</Td>
                                    <Td dim>{relTime(r.blocked_at)}</Td>
                                    <Td dim>{r.blocked_by_email ?? "—"}</Td>
                                    <Td dim>{r.blocked_reason ?? "—"}</Td>
                                    <Td><UnblockButton licenseId={r.id} /></Td>
                                </tr>
                            ))
                        }
                    </tbody>
                </Table>
            </section>

            {/* ─── IP flag ──────────────────────────────────── */}
            <section style={{ marginBottom: 28 }}>
                <h2 style={sectionH}>
                    IP fingerprint ({data.ipFlag.length})
                    <span style={subtleTag}>≥3 distinct activation IPs in last 24h</span>
                </h2>
                <Table>
                    <thead>
                        <tr>
                            <Th>Email</Th>
                            <Th w={120}>Plan</Th>
                            <Th w={120}>Distinct IPs</Th>
                            <Th>IP samples</Th>
                            <Th w={140}>Action</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.ipFlag.length === 0 ? <EmptyRow colSpan={5}>Nothing flagged.</EmptyRow> :
                            data.ipFlag.map((r) => (
                                <tr key={r.id}>
                                    <Td>{r.email}</Td>
                                    <Td dim>{r.plan_name}</Td>
                                    <Td>
                                        <Pill color="var(--danger)" bg="color-mix(in oklab, var(--danger) 14%, transparent)">
                                            {r.distinct_ips_24h}
                                        </Pill>
                                    </Td>
                                    <Td mono dim>{(r.ip_samples ?? []).slice(0, 3).join(" · ")}{(r.ip_samples?.length ?? 0) > 3 ? " …" : ""}</Td>
                                    <Td><BlockButton licenseId={r.id} suggestedReason={`Forum-shared key: ${r.distinct_ips_24h} distinct IPs in 24h`} /></Td>
                                </tr>
                            ))
                        }
                    </tbody>
                </Table>
            </section>

            {/* ─── Site flag ────────────────────────────────── */}
            <section>
                <h2 style={sectionH}>
                    Site count exceeds plan ({data.siteFlag.length})
                    <span style={subtleTag}>distinct site_hosts last 30d &gt; max_sites</span>
                </h2>
                <Table>
                    <thead>
                        <tr>
                            <Th>Email</Th>
                            <Th w={120}>Plan</Th>
                            <Th w={120}>Hosts (30d)</Th>
                            <Th w={120}>Plan max</Th>
                            <Th w={140}>Action</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.siteFlag.length === 0 ? <EmptyRow colSpan={5}>Nothing flagged.</EmptyRow> :
                            data.siteFlag.map((r) => (
                                <tr key={r.id}>
                                    <Td>{r.email}</Td>
                                    <Td dim>{r.plan_name}</Td>
                                    <Td>
                                        <Pill color="var(--danger)" bg="color-mix(in oklab, var(--danger) 14%, transparent)">
                                            {r.distinct_hosts_30d}
                                        </Pill>
                                    </Td>
                                    <Td dim>{r.max_sites === -1 ? "∞" : r.max_sites}</Td>
                                    <Td><BlockButton licenseId={r.id} suggestedReason={`${r.distinct_hosts_30d} distinct hosts in 30d (plan = ${r.max_sites === -1 ? "unlimited" : r.max_sites})`} /></Td>
                                </tr>
                            ))
                        }
                    </tbody>
                </Table>
            </section>
        </>
    );
}

const sectionH: React.CSSProperties = {
    margin: "32px 0 12px", fontSize: 14, fontWeight: 500,
    color: "var(--ink-2)", letterSpacing: "-0.01em",
    display: "flex", alignItems: "baseline", gap: 12,
};
const subtleTag: React.CSSProperties = {
    fontSize: 11, fontWeight: 400, color: "var(--ink-3)",
    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
    letterSpacing: "0.02em",
};
