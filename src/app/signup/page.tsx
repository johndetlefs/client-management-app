'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionallyPublicRoute } from '@/components/auth/ConditionallyPublicRoute';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { initializeNewUser } from '@/lib/initializeUser';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const userCredential = await signUp(email, password);
            
            // Initialize user profile and tenant
            const initResult = await initializeNewUser(userCredential.uid, email);
            
            if (!initResult.success) {
                setError(initResult.error || 'Failed to set up your account');
                return;
            }
            
            router.push('/workspace/dashboard');
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to create account. Please try again.');
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
                        <CardTitle>Create Account</CardTitle>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            Sign up to get started with your invoicing app.
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
                                autoComplete="new-password"
                            />

                            <Input
                                label="Confirm Password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                            />

                            <Button type="submit" variant="primary" loading={loading} className="w-full">
                                Create Account
                            </Button>

                            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                                Already have an account?{' '}
                                <Link href="/login" className="text-foreground font-medium hover:underline">
                                    Sign in
                                </Link>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </ConditionallyPublicRoute>
    );
}
