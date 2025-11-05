'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ConditionallyPublicRoute } from '@/components/auth/ConditionallyPublicRoute';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setLoading(true);

        try {
            await resetPassword(email);
            setSuccess(true);
        } catch (err) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to send reset email. Please try again.');
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
                        <CardTitle>Reset Password</CardTitle>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                            Enter your email address and we&apos;ll send you a link to reset your password.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-4">
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-600 dark:text-green-400">
                                    Password reset email sent! Check your inbox for further instructions.
                                </div>
                                <Link href="/login">
                                    <Button variant="secondary" className="w-full">
                                        Back to Sign In
                                    </Button>
                                </Link>
                            </div>
                        ) : (
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

                                <Button type="submit" variant="primary" loading={loading} className="w-full">
                                    Send Reset Link
                                </Button>

                                <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                                    Remember your password?{' '}
                                    <Link href="/login" className="text-foreground font-medium hover:underline">
                                        Sign in
                                    </Link>
                                </p>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ConditionallyPublicRoute>
    );
}
