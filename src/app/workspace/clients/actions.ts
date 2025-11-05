"use server";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client, ClientFormData, ClientUpdateData } from "@/types/client";

/**
 * Server action result type
 */
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper function to serialize Firestore Timestamps to Date objects
 */
function serializeClient(docId: string, data: Record<string, unknown>): Client {
  return {
    id: docId,
    ...data,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate()
        : data.createdAt,
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toDate()
        : data.updatedAt,
  } as Client;
}

/**
 * Get all clients for a tenant
 */
export async function getClients(
  tenantId: string
): Promise<ActionResult<Client[]>> {
  try {
    const clientsRef = collection(db, `tenants/${tenantId}/clients`);
    const q = query(clientsRef, orderBy("name", "asc"));
    const snapshot = await getDocs(q);

    const clients: Client[] = snapshot.docs.map((doc) =>
      serializeClient(doc.id, doc.data())
    );

    return { success: true, data: clients };
  } catch (error) {
    console.error("Error fetching clients:", error);
    return { success: false, error: "Failed to fetch clients" };
  }
}

/**
 * Get a single client by ID
 */
export async function getClient(
  tenantId: string,
  clientId: string
): Promise<ActionResult<Client>> {
  try {
    const clientRef = doc(db, `tenants/${tenantId}/clients`, clientId);
    const clientDoc = await getDoc(clientRef);

    if (!clientDoc.exists()) {
      return { success: false, error: "Client not found" };
    }

    const client = serializeClient(clientDoc.id, clientDoc.data());

    return { success: true, data: client };
  } catch (error) {
    console.error("Error fetching client:", error);
    return { success: false, error: "Failed to fetch client" };
  }
}

/**
 * Create a new client
 */
export async function createClient(
  tenantId: string,
  userId: string,
  data: ClientFormData
): Promise<ActionResult<string>> {
  try {
    const clientsRef = collection(db, `tenants/${tenantId}/clients`);

    const newClient = {
      ...data,
      tenantId,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(clientsRef, newClient);

    return { success: true, data: docRef.id };
  } catch (error) {
    console.error("Error creating client:", error);
    return { success: false, error: "Failed to create client" };
  }
}

/**
 * Update an existing client
 */
export async function updateClient(
  tenantId: string,
  clientId: string,
  data: ClientUpdateData
): Promise<ActionResult> {
  try {
    const clientRef = doc(db, `tenants/${tenantId}/clients`, clientId);

    const updateData = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(clientRef, updateData);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating client:", error);
    return { success: false, error: "Failed to update client" };
  }
}

/**
 * Delete a client
 */
export async function deleteClient(
  tenantId: string,
  clientId: string
): Promise<ActionResult> {
  try {
    const clientRef = doc(db, `tenants/${tenantId}/clients`, clientId);
    await deleteDoc(clientRef);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting client:", error);
    return { success: false, error: "Failed to delete client" };
  }
}

/**
 * Search clients by name or email
 */
export async function searchClients(
  tenantId: string,
  searchTerm: string
): Promise<ActionResult<Client[]>> {
  try {
    const clientsRef = collection(db, `tenants/${tenantId}/clients`);
    const snapshot = await getDocs(clientsRef);

    const searchLower = searchTerm.toLowerCase();
    const clients: Client[] = snapshot.docs
      .map((doc) => serializeClient(doc.id, doc.data()))
      .filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          (client.email && client.email.toLowerCase().includes(searchLower))
      );

    return { success: true, data: clients };
  } catch (error) {
    console.error("Error searching clients:", error);
    return { success: false, error: "Failed to search clients" };
  }
}
