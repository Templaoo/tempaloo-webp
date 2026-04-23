export function TrustRow() {
    return (
        <div className="glass rounded-2xl px-6 py-5 flex flex-wrap items-center justify-around gap-4 text-center">
            <Trust value="−70%" label="avg. page weight" />
            <Divider />
            <Trust value="30 sec" label="setup time" />
            <Divider />
            <Trust value="WP 6.0+" label="fully compatible" />
            <Divider />
            <Trust value="30-day" label="money-back" />
        </div>
    );
}

function Trust({ value, label }: { value: string; label: string }) {
    return (
        <div>
            <div className="text-white text-lg font-semibold tracking-tight">{value}</div>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mt-0.5">{label}</div>
        </div>
    );
}

function Divider() {
    return <span className="h-8 w-px bg-white/10 hidden sm:block" />;
}
