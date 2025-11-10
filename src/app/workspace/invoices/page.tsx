"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCurrentUserTenantId } from "@/lib/tenant";
import { Invoice, InvoiceFilterStatus } from "@/types/invoice";
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, isInvoiceOverdue, getDaysOverdue } from "@/lib/invoice-utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function InvoicesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<InvoiceFilterStatus>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Get tenant ID
    useEffect(() => {
        const loadTenantId = async () => {
            const id = await getCurrentUserTenantId();
            setTenantId(id);
        };
        loadTenantId();
    }, [user]);

    // Fetch invoices
    useEffect(() => {
        if (!tenantId) return;

        const invoicesRef = collection(db, `tenants/${tenantId}/invoices`);
        const q = query(invoicesRef, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedInvoices: Invoice[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                fetchedInvoices.push({
                    id: doc.id,
                    ...data,
                    // Normalize legacy "viewed" status to "sent" for backwards compatibility
                    status: data.status === "viewed" ? "sent" : data.status,
                    issueDate: data.issueDate?.toDate(),
                    dueDate: data.dueDate?.toDate(),
                    viewedAt: data.viewedAt?.toDate(),
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate(),
                } as Invoice);
            });
            setInvoices(fetchedInvoices);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    const handleCreateNew = () => {
        router.push("/workspace/invoices/new");
    };

    // Filter and search invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter((invoice) => {
            // Filter by status
            if (filterStatus !== "all" && invoice.status !== filterStatus) {
                return false;
            }

            // Search by client name or invoice number
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchesClient = invoice.clientName.toLowerCase().includes(term);
                const matchesNumber = invoice.invoiceDisplayNumber?.toLowerCase().includes(term) || invoice.invoiceNumber?.toLowerCase().includes(term);
                if (!matchesClient && !matchesNumber) {
                    return false;
                }
            }

            return true;
        });
    }, [invoices, filterStatus, searchTerm]);

    if (loading) {
        return (
            <div className="p-8">
                <p>Loading invoices...</p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Invoices</h1>
                    <p className="text-gray-600 mt-1">Manage and track your invoices</p>
                </div>
                <Button onClick={handleCreateNew}>
                    Create Invoice
                </Button>
            </div>

            {/* Filters */}
            <Card className="mb-6 p-4">
                <div className="flex gap-4 flex-wrap">
                    {/* Search */}
                    <input
                        type="text"
                        placeholder="Search by client or invoice number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-2 border rounded-md"
                    />

                    {/* Status filter */}
                    <div className="relative">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as InvoiceFilterStatus)}
                            className="w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="all">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="viewed">Viewed</option>
                            <option value="partially_paid">Partially Paid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="void">Void</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Invoice Table */}
            {filteredInvoices.length === 0 ? (
                <Card className="p-12 text-center">
                    <p className="text-gray-500 mb-4">
                        {searchTerm || filterStatus !== "all"
                            ? "No invoices match your filters"
                            : "No invoices yet"}
                    </p>
                    {!searchTerm && filterStatus === "all" && (
                        <Button onClick={handleCreateNew}>
                            Create First Invoice
                        </Button>
                    )}
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Invoice #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Client
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Issue Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Due Date
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Paid
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Balance
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-zinc-950 divide-y divide-zinc-200 dark:divide-zinc-800">
                                {filteredInvoices.map((invoice) => {
                                    const overdue = isInvoiceOverdue(invoice);
                                    const daysOverdue = invoice.dueDate && invoice.dueDate instanceof Date
                                        ? getDaysOverdue(invoice.dueDate)
                                        : 0;

                                    return (
                                        <tr
                                            key={invoice.id}
                                            onClick={() => router.push(`/workspace/invoices/${invoice.id}`)}
                                            className="hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-foreground">
                                                    {invoice.invoiceDisplayNumber || invoice.invoiceNumber || "Draft"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-foreground">{invoice.clientName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getStatusColor(invoice.status)} w-fit`}>
                                                        {getStatusLabel(invoice.status)}
                                                    </span>
                                                    {overdue && (
                                                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800 w-fit">
                                                            {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {invoice.issueDate && invoice.issueDate instanceof Date
                                                        ? formatDate(invoice.issueDate)
                                                        : "—"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {invoice.dueDate && invoice.dueDate instanceof Date
                                                        ? formatDate(invoice.dueDate)
                                                        : "—"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-medium text-foreground">
                                                    {formatCurrency(invoice.totalMinor)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {invoice.amountPaidMinor > 0
                                                        ? formatCurrency(invoice.amountPaidMinor)
                                                        : "—"}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className={`text-sm font-medium ${invoice.balanceDueMinor > 0 && invoice.status !== "draft"
                                                    ? "text-red-600 dark:text-red-400"
                                                    : "text-zinc-600 dark:text-zinc-400"
                                                    }`}>
                                                    {invoice.status !== "draft" && invoice.balanceDueMinor > 0
                                                        ? formatCurrency(invoice.balanceDueMinor)
                                                        : "—"}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
