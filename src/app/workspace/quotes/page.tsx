"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUserRole, getCurrentUserTenantId } from "@/lib/tenant";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/invoice-utils";
import { Quote } from "@/types/quote";

function toDate(value: unknown): Date | undefined {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "object" && value !== null && "toDate" in value) {
        return (value as { toDate: () => Date }).toDate();
    }

    return undefined;
}

export default function QuotesPage() {
    const { user } = useAuth();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [role, setRole] = useState<"owner" | "staff" | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const loadWorkspaceContext = async () => {
            setLoading(true);
            const [resolvedTenantId, resolvedRole] = await Promise.all([
                getCurrentUserTenantId(),
                getCurrentUserRole(),
            ]);

            setTenantId(resolvedTenantId);
            setRole(resolvedRole);
        };

        if (user) {
            loadWorkspaceContext().finally(() => setLoading(false));
        }
    }, [user]);

    useEffect(() => {
        if (!tenantId || (role !== "owner" && role !== "staff")) {
            return;
        }

        const quotesRef = collection(db, `tenants/${tenantId}/quotes`);
        const quotesQuery = query(quotesRef, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(quotesQuery, (snapshot) => {
            const nextQuotes: Quote[] = snapshot.docs.map((doc) => {
                const data = doc.data();

                return {
                    id: doc.id,
                    tenantId,
                    clientId: (data.clientId as string) || "",
                    jobId: (data.jobId as string) || "",
                    quoteNumber: data.quoteNumber as string | undefined,
                    quoteDisplayNumber: data.quoteDisplayNumber as string | undefined,
                    status: (data.status as Quote["status"]) || "draft",
                    clientName: (data.clientName as string) || "Unknown Client",
                    jobTitle: data.jobTitle as string | undefined,
                    totalMinor: typeof data.totalMinor === "number" ? data.totalMinor : 0,
                    createdAt: toDate(data.createdAt) || new Date(),
                    updatedAt: toDate(data.updatedAt) || new Date(),
                };
            });

            setQuotes(nextQuotes);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, role]);

    const filteredQuotes = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) {
            return quotes;
        }

        return quotes.filter((quote) => {
            const number = (quote.quoteDisplayNumber || quote.quoteNumber || "").toLowerCase();
            const clientName = quote.clientName.toLowerCase();
            const jobTitle = (quote.jobTitle || "").toLowerCase();

            return number.includes(term) || clientName.includes(term) || jobTitle.includes(term);
        });
    }, [quotes, searchTerm]);

    if (loading) {
        return (
            <div className="p-8">
                <p>Loading quotes...</p>
            </div>
        );
    }

    if (role !== "owner" && role !== "staff") {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <Card className="p-8 text-center">
                    <h1 className="text-2xl font-bold mb-2">Quotes</h1>
                    <p className="text-foreground/70">You do not have permission to view quotes.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Quotes</h1>
                <p className="text-gray-600 mt-1">View and manage tenant quotes</p>
            </div>

            <Card className="mb-6 p-4">
                <input
                    type="text"
                    placeholder="Search by quote number, client, or job..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                />
            </Card>

            {filteredQuotes.length === 0 ? (
                <Card className="p-12 text-center">
                    <p className="text-gray-500">
                        {searchTerm ? "No quotes match your search" : "No quotes yet"}
                    </p>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Quote #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Job
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Amount
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
                                {filteredQuotes.map((quote) => (
                                    <tr key={quote.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                            <Link
                                                href={`/workspace/quotes/${quote.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                {quote.quoteDisplayNumber || quote.quoteNumber || "Draft"}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                            {quote.clientName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                                            {quote.jobTitle || "—"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
                                                {quote.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-400">
                                            {formatDate(quote.createdAt instanceof Date ? quote.createdAt : new Date())}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-foreground">
                                            {formatCurrency(quote.totalMinor)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
