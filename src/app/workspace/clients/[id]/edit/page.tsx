'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { getClient, createClient, updateClient } from '../../actions';
import { CLIENT_ROUTES } from '@/lib/routes';
import type { ClientFormData, ClientContact } from '@/types/client';

export default function ClientEditPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const clientId = params.id as string;
    const isNewClient = clientId === 'new';

    const [loading, setLoading] = useState(!isNewClient);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [abn, setAbn] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [notes, setNotes] = useState('');

    // Address fields
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [postcode, setPostcode] = useState('');
    const [country, setCountry] = useState('Australia');

    // Additional contacts
    const [contacts, setContacts] = useState<ClientContact[]>([]);

    useEffect(() => {
        if (isNewClient) return;

        const loadClient = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant.');
                setLoading(false);
                return;
            }

            const result = await getClient(tenantId, clientId);
            if (result.success) {
                const client = result.data;
                setName(client.name);
                setEmail(client.email || '');
                setPhone(client.phone || '');
                setAbn(client.abn || '');
                setIsActive(client.isActive);
                setNotes(client.notes || '');

                if (client.address) {
                    setStreet(client.address.street || '');
                    setCity(client.address.city || '');
                    setState(client.address.state || '');
                    setPostcode(client.address.postcode || '');
                    setCountry(client.address.country || 'Australia');
                }

                if (client.contacts) {
                    setContacts(client.contacts);
                }
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadClient();
    }, [isNewClient, clientId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (!name.trim()) {
            setError('Client name is required');
            setSaving(false);
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId || !user) {
            setError('Unable to determine your tenant.');
            setSaving(false);
            return;
        }

        const formData: ClientFormData = {
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
            abn: abn.trim() || undefined,
            isActive,
            notes: notes.trim() || undefined,
            address: (street || city || state || postcode) ? {
                street: street.trim() || undefined,
                city: city.trim() || undefined,
                state: state.trim() || undefined,
                postcode: postcode.trim() || undefined,
                country: country.trim() || undefined,
            } : undefined,
            contacts: contacts.length > 0 ? contacts : undefined,
        };

        let result;
        if (isNewClient) {
            result = await createClient(tenantId, user.uid, formData);
        } else {
            result = await updateClient(tenantId, clientId, formData);
        }

        if (result.success) {
            if (isNewClient && typeof result.data === 'string') {
                router.push(CLIENT_ROUTES.VIEW(result.data));
            } else {
                router.push(CLIENT_ROUTES.VIEW(clientId));
            }
        } else {
            setError(result.error);
            setSaving(false);
        }
    };

    const addContact = () => {
        setContacts([...contacts, { name: '', email: '', phone: '', position: '' }]);
    };

    const removeContact = (index: number) => {
        setContacts(contacts.filter((_, i) => i !== index));
    };

    const updateContact = (index: number, field: keyof ClientContact, value: string) => {
        const updated = [...contacts];
        updated[index] = { ...updated[index], [field]: value };
        setContacts(updated);
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-zinc-600 dark:text-zinc-400">Loading client...</p>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            <Link href={CLIENT_ROUTES.LIST} className="hover:text-foreground">
                                Clients
                            </Link>
                            <span>/</span>
                            {!isNewClient && (
                                <>
                                    <Link href={CLIENT_ROUTES.VIEW(clientId)} className="hover:text-foreground">
                                        {name || 'Client'}
                                    </Link>
                                    <span>/</span>
                                </>
                            )}
                            <span className="text-foreground">{isNewClient ? 'New Client' : 'Edit'}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {isNewClient ? 'New Client' : 'Edit Client'}
                        </h1>
                    </div>                    {/* Error Display */}
                    {error && (
                        <Card className="mb-6 border-red-200 dark:border-red-800">
                            <CardContent className="py-4">
                                <p className="text-red-600 dark:text-red-400">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Basic Information */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                                        Client Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="ABC Company Pty Ltd"
                                        required
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                                            Email
                                        </label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="contact@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-2">
                                            Phone
                                        </label>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="+61 2 1234 5678"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="abn" className="block text-sm font-medium text-foreground mb-2">
                                        ABN
                                    </label>
                                    <Input
                                        id="abn"
                                        type="text"
                                        value={abn}
                                        onChange={(e) => setAbn(e.target.value)}
                                        placeholder="12 345 678 901"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        id="isActive"
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700"
                                    />
                                    <label htmlFor="isActive" className="text-sm font-medium text-foreground">
                                        Active client
                                    </label>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Address */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Address</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label htmlFor="street" className="block text-sm font-medium text-foreground mb-2">
                                        Street Address
                                    </label>
                                    <Input
                                        id="street"
                                        type="text"
                                        value={street}
                                        onChange={(e) => setStreet(e.target.value)}
                                        placeholder="123 Main Street"
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label htmlFor="city" className="block text-sm font-medium text-foreground mb-2">
                                            City
                                        </label>
                                        <Input
                                            id="city"
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            placeholder="Sydney"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="state" className="block text-sm font-medium text-foreground mb-2">
                                            State
                                        </label>
                                        <Input
                                            id="state"
                                            type="text"
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            placeholder="NSW"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="postcode" className="block text-sm font-medium text-foreground mb-2">
                                            Postcode
                                        </label>
                                        <Input
                                            id="postcode"
                                            type="text"
                                            value={postcode}
                                            onChange={(e) => setPostcode(e.target.value)}
                                            placeholder="2000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="country" className="block text-sm font-medium text-foreground mb-2">
                                        Country
                                    </label>
                                    <Input
                                        id="country"
                                        type="text"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        placeholder="Australia"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Additional Contacts */}
                        <Card className="mb-6">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>Additional Contacts</CardTitle>
                                    <Button type="button" variant="secondary" onClick={addContact}>
                                        + Add Contact
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {contacts.length === 0 ? (
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        No additional contacts added yet.
                                    </p>
                                ) : (
                                    contacts.map((contact, index) => (
                                        <div key={index} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="text-sm font-medium text-foreground">Contact {index + 1}</h4>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() => removeContact(index)}
                                                    className="text-xs px-2 py-1"
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                            <div className="grid gap-3 md:grid-cols-2">
                                                <Input
                                                    type="text"
                                                    value={contact.name}
                                                    onChange={(e) => updateContact(index, 'name', e.target.value)}
                                                    placeholder="Contact Name"
                                                />
                                                <Input
                                                    type="text"
                                                    value={contact.position || ''}
                                                    onChange={(e) => updateContact(index, 'position', e.target.value)}
                                                    placeholder="Position"
                                                />
                                                <Input
                                                    type="email"
                                                    value={contact.email || ''}
                                                    onChange={(e) => updateContact(index, 'email', e.target.value)}
                                                    placeholder="Email"
                                                />
                                                <Input
                                                    type="tel"
                                                    value={contact.phone || ''}
                                                    onChange={(e) => updateContact(index, 'phone', e.target.value)}
                                                    placeholder="Phone"
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Additional notes about this client..."
                                    rows={4}
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                                />
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => router.back()}
                                disabled={saving}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving}
                                className="flex-1"
                            >
                                {saving ? 'Saving...' : (isNewClient ? 'Create Client' : 'Save Changes')}
                            </Button>
                        </div>
                    </form>
                </main>
            </div>
        </ProtectedRoute>
    );
}
