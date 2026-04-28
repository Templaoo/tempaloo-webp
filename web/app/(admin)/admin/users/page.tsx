import Link from "next/link";
import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, EmptyRow, Pager, Pill } from "@/components/admin/Shell";
import { eur, num, relTime, statusTone } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface UsersResp {
    users: Array<{
        id: string; email: string; created_at: string; freemius_user_id: number | null;
        license_count: string; last_activity: string;
        top_plan_monthly_cents: string; top_paid_plan: string | null;
        has_trial: boolean; has_paid_active: boolean;
    }>;
    page: number; page_size: number; total: number;
}

export default async function UsersPage({ searchParams }: { searchParams: { q?: string; plan?: string; status?: string; page?: string } }) {
    const sp = new URLSearchParams();
    if (searchParams.q) sp.set("q", searchParams.q);
    if (searchParams.plan) sp.set("plan", searchParams.plan);
    if (searchParams.status) sp.set("status", searchParams.status);
    if (searchParams.page) sp.set("page", searchParams.page);

    const data = await adminGet<UsersResp>(`/admin/users?${sp.toString()}`);

    return (
        <>
            <PageHeader eyebrow="USERS" title="Users" subtitle={`${num(data.total)} total · search by email or filter by plan / status.`} />

            <Filters q={searchParams.q} plan={searchParams.plan} status={searchParams.status} />

            <Table>
                <thead>
                    <tr>
                        <Th>Email</Th>
                        <Th w={120}>Status</Th>
                        <Th w={120}>Plan</Th>
                        <Th w={100}>Licenses</Th>
                        <Th w={120}>Top MRR</Th>
                        <Th w={140}>Last activity</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.users.length === 0 ? (
                        <EmptyRow colSpan={6}>No users match this filter.</EmptyRow>
                    ) : data.users.map((u) => {
                        const tone = u.has_paid_active ? statusTone("active")
                                   : u.has_trial ? statusTone("trialing")
                                   : { color: "var(--ink-3)", bg: "var(--bg-2)", label: "Free" };
                        return (
                            <tr key={u.id} style={{ transition: "background .12s ease" }}>
                                <Td>
                                    <Link href={`/admin/users/${u.id}`} style={{ color: "var(--ink)", fontWeight: 500 }}>
                                        {u.email}
                                    </Link>
                                </Td>
                                <Td><Pill color={tone.color} bg={tone.bg}>{tone.label}</Pill></Td>
                                <Td dim>{u.top_paid_plan ?? "free"}</Td>
                                <Td>{u.license_count}</Td>
                                <Td>{Number(u.top_plan_monthly_cents) > 0 ? eur(u.top_plan_monthly_cents) : "—"}</Td>
                                <Td dim>{relTime(u.last_activity)}</Td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table>

            <Pager
                page={data.page} pageSize={data.page_size} total={data.total}
                basePath="/admin/users"
                query={{ q: searchParams.q, plan: searchParams.plan, status: searchParams.status }}
            />
        </>
    );
}

function Filters({ q, plan, status }: { q?: string; plan?: string; status?: string }) {
    return (
        <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input name="q" defaultValue={q ?? ""} placeholder="Search email…"
                   style={{ flex: 1, minWidth: 220, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
            <select name="plan" defaultValue={plan ?? ""} style={selectStyle}>
                <option value="">All plans</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="business">Business</option>
                <option value="unlimited">Unlimited</option>
            </select>
            <select name="status" defaultValue={status ?? ""} style={selectStyle}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="canceled">Canceled</option>
                <option value="expired">Expired</option>
            </select>
            <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
        </form>
    );
}

const selectStyle: React.CSSProperties = {
    height: 36, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)",
    fontSize: 13.5,
};
