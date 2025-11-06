"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCurrentUserTenantId } from "@/lib/tenant";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";
import { createDraftInvoice } from "../actions";
import { InvoiceFormData } from "@/types/invoice";

export default function NewInvoicePage() {
    const { user } = useAuth();
    const router = useRouter();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Get tenant ID
    useEffect(() => {
        const loadTenantId = async () => {
            const id = await getCurrentUserTenantId();
            setTenantId(id);
        };
        loadTenantId();
    }, [user]);

    // Fetch clients
    useEffect(() => {
        if (!tenantId) return;

        const clientsRef = collection(db, `tenants/${tenantId}/clients`);
        const q = query(clientsRef, where("isActive", "==", true), orderBy("name"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedClients: Array<{ id: string; name: string }> = [];
            snapshot.forEach((doc) => {
                fetchedClients.push({
                    id: doc.id,
                    name: doc.data().name,
                });
            });
            setClients(fetchedClients);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!tenantId || !user) return;

        const formData = new FormData(e.currentTarget);
        const clientId = formData.get("clientId") as string;
        const dueDateStr = formData.get("dueDate") as string;
        const notes = formData.get("notes") as string;
        const paymentInstructions = formData.get("paymentInstructions") as string;

        const data: InvoiceFormData = {
            clientId,
            dueDate: dueDateStr ? new Date(dueDateStr) : undefined,
            notes: notes || undefined,
            paymentInstructions: paymentInstructions || undefined,
        };

        setCreating(true);
        try {
            const result = await createDraftInvoice(tenantId, user.uid, data);

            if (result.success) {
                router.push(`/workspace/invoices/${result.data}`);
            } else {
                alert(result.error);
                setCreating(false);
            }
        } catch (error) {
            console.error("Error creating invoice:", error);
            alert("Failed to create invoice");
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <p>Loading...</p>
            </div>
        );
    }

    if (clients.length === 0) {
        return (
            <div className="p-8 max-w-2xl mx-auto">
                <Card className="p-12 text-center">
                    <h2 className="text-xl font-bold mb-2">No Active Clients</h2>
                    <p className="text-gray-600 mb-4">
                        You need at least one active client to create an invoice
                    </p>
                    <div className="flex gap-3 justify-center">
                        <Link href="/workspace/clients">
                            <Button>Go to Clients</Button>
                        </Link>
                        <Link href="/workspace/invoices">
                            <Button variant="secondary">Back to Invoices</Button>
                        </Link>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <div className="mb-6">
                <Link href="/workspace/invoices" className="text-blue-600 hover:underline mb-2 inline-block">
                    ← Back to Invoices
                </Link>
                <h1 className="text-3xl font-bold">Create Invoice</h1>
                <p className="text-gray-600 mt-1">Select a client and configure invoice settings</p>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        {/* Client Selection */}
                        <div>
                            <label htmlFor="clientId" className="block text-sm font-medium mb-2">
                                Client *
                            </label>
                            <div className="relative">
                                <select
                                    id="clientId"
                                    name="clientId"
                                    required
                                    className="w-full pl-3 pr-10 py-2 rounded-lg border border-gray-300 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="">Select a client...</option>
                                    {clients.map((client) => (
                                        <option key={client.id} value={client.id}>
                                            {client.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Choose the client you want to invoice
                            </p>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label htmlFor="dueDate" className="block text-sm font-medium mb-2">
                                Due Date
                            </label>
                            <Input
                                id="dueDate"
                                name="dueDate"
                                type="date"
                                className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Optional: When payment is due
                            </p>
                        </div>

                        {/* Notes */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium mb-2">
                                Notes
                            </label>
                            <textarea
                                id="notes"
                                name="notes"
                                rows={3}
                                placeholder="Internal notes about this invoice..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Optional: Internal notes (not shown to client)
                            </p>
                        </div>

                        {/* Payment Instructions */}
                        <div>
                            <label htmlFor="paymentInstructions" className="block text-sm font-medium mb-2">
                                Payment Instructions
                            </label>
                            <textarea
                                id="paymentInstructions"
                                name="paymentInstructions"
                                rows={3}
                                placeholder="Bank details, payment terms, etc..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Optional: Instructions shown to client on the invoice
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-8 pt-6 border-t">
                        <Link href="/workspace/invoices" className="flex-1">
                            <Button type="button" variant="secondary" disabled={creating} className="w-full">
                                Cancel
                            </Button>
                        </Link>
                        <Button type="submit" disabled={creating} className="flex-1">
                            {creating ? "Creating..." : "Create Draft Invoice"}
                        </Button>
                    </div>
                </form>
            </Card>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="font-medium text-blue-900 mb-2">Next Steps</h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>After creating the draft, you&apos;ll add billable items from the client&apos;s jobs</li>
                    <li>Review the invoice totals and details</li>
                    <li>Issue & send the invoice to generate an invoice number</li>
                </ol>
            </div>
        </div>
    );
}
