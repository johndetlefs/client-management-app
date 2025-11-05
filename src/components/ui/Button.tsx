import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
    loading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    loading = false,
    disabled,
    className = '',
    ...props
}: ButtonProps) {
    const baseStyles =
        'cursor-pointer rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
        primary:
            'px-6 py-2 bg-foreground text-background hover:bg-foreground/90 focus:ring-foreground',
        secondary:
            'px-6 py-2 border border-foreground/20 text-foreground hover:bg-foreground/5 focus:ring-foreground/20',
        ghost: 'px-6 py-2 text-foreground hover:bg-foreground/5 focus:ring-foreground/20',
        icon: 'p-2 border border-foreground/20 text-foreground hover:bg-foreground/5 focus:ring-foreground/20',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    Loading...
                </span>
            ) : (
                children
            )}
        </button>
    );
}
