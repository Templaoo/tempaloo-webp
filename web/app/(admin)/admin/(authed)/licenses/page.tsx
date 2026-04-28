import Link from "next/link";
import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, EmptyRow, Pager, Pill } from "@/components/admin/Shell";
import { num, relTime, shortDate, statusTone } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    licenses: Array<{
        id: string; license_key: string; status: string; billing: string;
        current_period_end: string | null; canceled_at: string | null; created_at: string;
        user_id: string; email: string;
        plan_code: string; plan_name: string;
        active_sites: string; images_used_this_month: number | null;
    }>;
    page: number; page_size: number; total: number;
}

export default async function LicensesPage({ searchParams }: { searchParams: { q?: string; plan?: string; status?: string; billing?: string; page?: string } }) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) sp.set(k, v);
    const data = await adminGet<Resp>(`/admin/licenses?${sp.toString()}`);

    return (
        <>
            <PageHeader eyebrow="LICENSES" title="Licenses" subtitle={`${num(data.total)} total · search by email or license key.`} />

            <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search email or license key…"
                       style={{ flex: 1, minWidth: 240, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <select name="plan" defaultValue={searchParams.plan ?? ""} style={selectStyle}>
                    <option value="">All plans</option>
                    <option value="free">Free</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="business">Business</option><option value="unlimited">Unlimited</option>
                </select>
                <select name="status" defaultValue={searchParams.status ?? ""} style={selectStyle}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option><option value="trialing">Trialing</option><option value="past_due">Past due</option><option value="canceled">Canceled</option><option value="expired">Expired</option>
                </select>
                <select name="billing" defaultValue={searchParams.billing ?? ""} style={selectStyle}>
                    <option value="">All billing</option>
                    <option value="monthly">Monthly</option><option value="annual">Annual</option><option value="lifetime">Lifetime</option><option value="free">Free</option>
                </select>
                <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
            </form>

            <Table>
                <thead>
                    <tr>
                        <Th>Email</Th>
                        <Th w={120}>Plan</Th>
                        <Th w={120}>Status</Th>
                        <Th w={100}>Billing</Th>
                        <Th w={100}>Sites</Th>
                        <Th w={120}>Used (mo)</Th>
                        <Th w={120}>Renews</Th>
                        <Th w={130}>Created</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.licenses.length === 0 ? <EmptyRow colSpan={8}>No licenses match this filter.</EmptyRow> :
                        data.licenses.map((l) => {
                            const tone = statusTone(l.status);
                            return (
                                <tr key={l.id}>
                                    <Td>
                                        <Link href={`/admin/users/${l.user_id}`} style={{ color: "var(--ink)", fontWeight: 500 }}>{l.email}</Link>
                                    </Td>
                                    <Td dim>{l.plan_name}</Td>
                                    <Td><Pill color={tone.color} bg={tone.bg}>{tone.label}</Pill></Td>
                                    <Td dim>{l.billing}</Td>
                                    <Td>{l.active_sites}</Td>
                                    <Td>{l.images_used_this_month != null ? num(l.images_used_this_month) : "0"}</Td>
                                    <Td dim>{l.current_period_end ? shortDate(l.current_period_end) : "—"}</Td>
                                    <Td dim>{relTime(l.created_at)}</Td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </Table>

            <Pager page={data.page} pageSize={data.page_size} total={data.total} basePath="/admin/licenses"
                   query={{ q: searchParams.q, plan: searchParams.plan, status: searchParams.status, billing: searchParams.billing }} />
        </>
    );
}

const selectStyle: React.CSSProperties = {
    height: 36, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5,
};
