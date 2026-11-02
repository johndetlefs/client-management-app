import { redirect } from "next/navigation";
import { legacyFinanceDestination } from "@/lib/routes";
export default async function LegacyFinancesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    redirect(legacyFinanceDestination(await searchParams));
}
