import { Timestamp } from 'firebase/firestore';

/**
 * Client contact information
 */
export interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    position?: string;
}

/**
 * Client address information
 */
export interface ClientAddress {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
}

/**
 * Main Client entity stored in Firestore
 * Path: tenants/{tenantId}/clients/{clientId}
 */
export interface Client {
    id: string;
    tenantId: string;
    
    // Core information
    name: string;
    email?: string;
    phone?: string;
    abn?: string; // Australian Business Number
    
    // Address
    address?: ClientAddress;
    
    // Additional contacts
    contacts?: ClientContact[];
    
    // Metadata
    notes?: string;
    isActive: boolean;
    
    // Timestamps
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string; // User ID who created the client
}

/**
 * Form data for creating/editing clients
 * (excludes auto-generated fields)
 */
export type ClientFormData = Omit<Client, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy'>;

/**
 * Partial client data for updates
 */
export type ClientUpdateData = Partial<Omit<Client, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>;
