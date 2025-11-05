'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionallyPublicRoute } from '@/components/auth/ConditionallyPublicRoute';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(email, password);
            router.push('/dashboard');
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to sign in. Please check your credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ConditionallyPublicRoute>
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Sign In</CardTitle>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            Welcome back! Please sign in to continue.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            <Input
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="email"
                            />

                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="current-password"
                            />

                            <div className="flex items-center justify-between text-sm">
                                <Link
                                    href="/reset-password"
                                    className="text-foreground hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>

                            <Button type="submit" variant="primary" loading={loading} className="w-full">
                                Sign In
                            </Button>

                            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                                Don&apos;t have an account?{' '}
                                <Link href="/signup" className="text-foreground font-medium hover:underline">
                                    Sign up
                                </Link>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </ConditionallyPublicRoute>
    );
}
