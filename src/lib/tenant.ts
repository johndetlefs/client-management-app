import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * User profile document stored at /users/{userId}
 */
export interface UserProfile {
    uid: string;
    email: string;
    tenantId: string;
    createdAt: Date;
}

/**
 * Tenant user role document stored at /tenants/{tenantId}/users/{userId}
 */
export interface TenantUser {
    uid: string;
    email: string;
    role: 'owner' | 'staff';
    displayName?: string;
}

/**
 * Get the current user's tenant ID from their user profile
 * @returns tenantId or null if not found/authenticated
 */
export async function getCurrentUserTenantId(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
        return null;
    }

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            console.error('User profile document not found');
            return null;
        }

        const userData = userDoc.data() as UserProfile;
        return userData.tenantId || null;
    } catch (error) {
        console.error('Error fetching user tenant ID:', error);
        return null;
    }
}

/**
 * Get the current user's role within their tenant
 * @returns role or null if not found
 */
export async function getCurrentUserRole(): Promise<'owner' | 'staff' | null> {
    const user = auth.currentUser;
    if (!user) {
        return null;
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
        return null;
    }

    try {
        const tenantUserDocRef = doc(db, `tenants/${tenantId}/users`, user.uid);
        const tenantUserDoc = await getDoc(tenantUserDocRef);

        if (!tenantUserDoc.exists()) {
            return null;
        }

        const tenantUserData = tenantUserDoc.data() as TenantUser;
        return tenantUserData.role || null;
    } catch (error) {
        console.error('Error fetching user role:', error);
        return null;
    }
}
