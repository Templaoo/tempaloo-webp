"use client";

import { useMemo, useState } from "react";
import { LicenseCard, type DashLicense } from "./LicenseCard";
import {
    LicenseFilter, applyLicenseFilter, CsvExportButton,
    type SortKey, type FilterPlan,
} from "./DashboardExtras";

/**
 * Client wrapper around the license list — owns filter/sort state and
 * exposes the CSV export. Server component sends the full licenses
 * array; we only need to re-derive the visible subset on the client.
 */
export function LicenseListClient({ licenses }: { licenses: DashLicense[] }) {
    const [sort, setSort] = useState<SortKey>("newest");
    const [filter, setFilter] = useState<FilterPlan>("all");

    const visible = useMemo(
        () => applyLicenseFilter(licenses, filter, sort),
        [licenses, filter, sort],
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {licenses.length >= 2 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <LicenseFilter
                            total={licenses.length}
                            filter={filter}
                            onFilter={setFilter}
                            sort={sort}
                            onSort={setSort}
                        />
                    </div>
                    <CsvExportButton licenses={licenses} />
                </div>
            )}
            {licenses.length === 1 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <CsvExportButton licenses={licenses} />
                </div>
            )}
            {visible.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--line-2)", borderRadius: 10, fontSize: 14, color: "var(--ink-3)" }}>
                    No licenses match this filter.
                </div>
            ) : (
                visible.map((l) => <LicenseCard key={l.id} license={l} />)
            )}
        </div>
    );
}
