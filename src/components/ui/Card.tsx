import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
}

export function Card({ children, className = '' }: CardProps) {
    return (
        <div
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm ${className}`}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '' }: CardProps) {
    return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardContent({ children, className = '' }: CardProps) {
    return <div className={`px-6 pb-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: CardProps) {
    return (
        <h2 className={`text-2xl font-semibold text-foreground ${className}`}>
            {children}
        </h2>
    );
}
