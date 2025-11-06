'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getTenantSettings, updateTenantSettings } from './actions';
import { TenantSettings, type TaxType } from '@/types/tenant';
import { getCurrentUserTenantId } from '@/lib/tenant';

export default function SettingsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [settings, setSettings] = useState<TenantSettings>({
        businessName: '',
        abn: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        bankAccount: {
            accountName: '',
            bsb: '',
            accountNumber: '',
        },
        tax: {
            taxType: 'GST',
            defaultRate: 0.10,
        },
        invoicePrefix: '',
        invoiceTerms: '',
        invoiceFooter: '',
    });

    useEffect(() => {
        async function loadSettings() {
            if (!user) return;

            setLoading(true);
            setError('');

            // Get tenant ID
            const tid = await getCurrentUserTenantId();
            if (!tid) {
                setError('Failed to load tenant information');
                setLoading(false);
                return;
            }

            setTenantId(tid);

            const result = await getTenantSettings(tid);

            if (result.success && result.data) {
                const data = result.data;
                setSettings((prev) => ({
                    ...prev,
                    ...data,
                    bankAccount: data.bankAccount || prev.bankAccount,
                    tax: data.tax || prev.tax,
                }));
            } else if (!result.success) {
                setError(result.error || 'Failed to load settings');
            }

            setLoading(false);
        }

        loadSettings();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenantId || !user) {
            setError('Missing tenant or user information');
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        const result = await updateTenantSettings(tenantId, user.uid, settings);

        if (result.success) {
            setSuccess('Settings saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } else {
            setError(result.error || 'Failed to save settings');
        }

        setSaving(false);
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                        <p className="text-foreground/60">Loading settings...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-foreground/60">
                    Manage your business information and invoice settings
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Business Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Business Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label="Business Name"
                            value={settings.businessName || ''}
                            onChange={(e) =>
                                setSettings({ ...settings, businessName: e.target.value })
                            }
                            placeholder="Your Business Pty Ltd"
                        />

                        <Input
                            label="ABN"
                            value={settings.abn || ''}
                            onChange={(e) => setSettings({ ...settings, abn: e.target.value })}
                            placeholder="12 345 678 901"
                        />

                        <Input
                            label="Address"
                            value={settings.address || ''}
                            onChange={(e) =>
                                setSettings({ ...settings, address: e.target.value })
                            }
                            placeholder="123 Main St, Sydney NSW 2000"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Phone"
                                type="tel"
                                value={settings.phone || ''}
                                onChange={(e) =>
                                    setSettings({ ...settings, phone: e.target.value })
                                }
                                placeholder="(02) 1234 5678"
                            />

                            <Input
                                label="Email"
                                type="email"
                                value={settings.email || ''}
                                onChange={(e) =>
                                    setSettings({ ...settings, email: e.target.value })
                                }
                                placeholder="info@business.com.au"
                            />
                        </div>

                        <Input
                            label="Website"
                            type="url"
                            value={settings.website || ''}
                            onChange={(e) =>
                                setSettings({ ...settings, website: e.target.value })
                            }
                            placeholder="https://www.business.com.au"
                        />
                    </CardContent>
                </Card>

                {/* Bank Account Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Bank Account Details</CardTitle>
                        <p className="text-sm text-foreground/60 mt-2">
                            These details will appear on your invoices for customer payments
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label="Account Name"
                            value={settings.bankAccount?.accountName || ''}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    bankAccount: {
                                        ...settings.bankAccount!,
                                        accountName: e.target.value,
                                    },
                                })
                            }
                            placeholder="Your Business Pty Ltd"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="BSB"
                                value={settings.bankAccount?.bsb || ''}
                                onChange={(e) => {
                                    // Format BSB with hyphen (XXX-XXX)
                                    let value = e.target.value.replace(/\D/g, '');
                                    if (value.length > 3) {
                                        value = value.slice(0, 3) + '-' + value.slice(3, 6);
                                    }
                                    setSettings({
                                        ...settings,
                                        bankAccount: {
                                            ...settings.bankAccount!,
                                            bsb: value,
                                        },
                                    });
                                }}
                                placeholder="123-456"
                                maxLength={7}
                            />

                            <Input
                                label="Account Number"
                                value={settings.bankAccount?.accountNumber || ''}
                                onChange={(e) => {
                                    // Only allow digits
                                    const value = e.target.value.replace(/\D/g, '');
                                    setSettings({
                                        ...settings,
                                        bankAccount: {
                                            ...settings.bankAccount!,
                                            accountNumber: value,
                                        },
                                    });
                                }}
                                placeholder="12345678"
                                maxLength={9}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tax Settings</CardTitle>
                        <p className="text-sm text-foreground/60 mt-2">
                            Configure default tax settings for invoices
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Tax Type</label>
                            <div className="relative">
                                <select
                                    value={settings.tax?.taxType || 'GST'}
                                    onChange={(e) =>
                                        setSettings({
                                            ...settings,
                                            tax: {
                                                ...settings.tax!,
                                                taxType: e.target.value as TaxType,
                                            },
                                        })
                                    }
                                    className="w-full pl-4 pr-10 py-2 rounded-lg border border-foreground/20 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="GST">GST (Goods and Services Tax)</option>
                                    <option value="VAT">VAT (Value Added Tax)</option>
                                    <option value="Sales Tax">Sales Tax</option>
                                    <option value="None">None</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Input
                                label="Default Tax Rate (%)"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={
                                    settings.tax?.defaultRate
                                        ? (settings.tax.defaultRate * 100).toFixed(2)
                                        : '10.00'
                                }
                                onChange={(e) => {
                                    const percentage = parseFloat(e.target.value) || 0;
                                    setSettings({
                                        ...settings,
                                        tax: {
                                            ...settings.tax!,
                                            defaultRate: percentage / 100,
                                        },
                                    });
                                }}
                                placeholder="10.00"
                            />
                            <p className="text-xs text-foreground/60 mt-1">
                                Enter as percentage (e.g., 10 for 10%)
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label="Invoice Prefix"
                            value={settings.invoicePrefix || ''}
                            onChange={(e) =>
                                setSettings({ ...settings, invoicePrefix: e.target.value })
                            }
                            placeholder="INV"
                        />
                        <p className="text-xs text-foreground/60 -mt-2">
                            Optional prefix for invoice numbers (e.g., INV-2025-001)
                        </p>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Payment Terms
                            </label>
                            <textarea
                                value={settings.invoiceTerms || ''}
                                onChange={(e) =>
                                    setSettings({ ...settings, invoiceTerms: e.target.value })
                                }
                                placeholder="Payment due within 14 days of invoice date"
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Invoice Footer
                            </label>
                            <textarea
                                value={settings.invoiceFooter || ''}
                                onChange={(e) =>
                                    setSettings({ ...settings, invoiceFooter: e.target.value })
                                }
                                placeholder="Thank you for your business!"
                                rows={2}
                                className="w-full px-4 py-2 rounded-lg border border-foreground/20 bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Error/Success Messages */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
                        {success}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                    <Button type="submit" variant="primary" loading={saving} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => router.back()}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                </div>
            </form>
        </div>
    );
}
