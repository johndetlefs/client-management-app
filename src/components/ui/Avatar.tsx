'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface AvatarProps {
    email: string;
    photoURL?: string | null;
    displayName?: string | null;
    size?: number;
    className?: string;
}

export function Avatar({ email, photoURL, displayName, size = 40, className = '' }: AvatarProps) {
    const [imageError, setImageError] = useState(false);

    // Generate Gravatar URL from email
    const getGravatarUrl = (email: string, size: number): string => {
        // Simple hash function for Gravatar (MD5 in browser)
        const hash = Array.from(
            new TextEncoder().encode(email.toLowerCase().trim())
        ).reduce((hash, byte) => {
            return ((hash << 5) - hash + byte) | 0;
        }, 0).toString(16);
        return `https://www.gravatar.com/avatar/${hash}?s=${size * 2}&d=identicon`;
    };

    // Determine which image to use: Google profile photo, then Gravatar
    const imageUrl = photoURL && !imageError ? photoURL : getGravatarUrl(email, size);

    // Get initials for fallback
    const getInitials = (): string => {
        if (displayName) {
            const names = displayName.split(' ');
            if (names.length >= 2) {
                return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
            }
            return displayName.slice(0, 2).toUpperCase();
        }
        return email.slice(0, 2).toUpperCase();
    };

    return (
        <div
            className={`relative rounded-full overflow-hidden bg-foreground/10 flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            <Image
                src={imageUrl}
                alt={displayName || email}
                width={size}
                height={size}
                className="object-cover"
                onError={() => setImageError(true)}
                unoptimized
            />
            {imageError && (
                <div className="absolute inset-0 flex items-center justify-center text-foreground/60 text-xs font-medium">
                    {getInitials()}
                </div>
            )}
        </div>
    );
}
