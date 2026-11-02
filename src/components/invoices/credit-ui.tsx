export const selectClass = "w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";
export const creditMoney = (currency: string, minor: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(minor / 100);
export const creditDate = (value?: string) => value ? new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Australia/Sydney" }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—";
export function CreditStatus({ status }: { status: "draft" | "issued" }) {
    return <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${status === "draft" ? "bg-gray-100 text-gray-800" : "bg-blue-100 text-blue-800"}`}>{status === "draft" ? "Draft" : "Issued"}</span>;
}
