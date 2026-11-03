import { redirect } from "next/navigation";
import { ExpensesWorkspace } from "./ExpensesWorkspace";
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const { tab } = await searchParams;
    if (tab === "bas") redirect("/workspace/bookkeeping/bas");
    if (tab === "settings") redirect("/workspace/settings/expenses");
    return <ExpensesWorkspace />;
}
