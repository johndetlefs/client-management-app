"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Client, ClientFormData, ClientUpdateData } from "@/types/client";

/**
 * Server action result type
 */
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper function to convert Firestore document to Client
 */
function docToClient(
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot
): Client {
  const data = doc.data();
  if (!data) throw new Error("Document has no data");

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Client;
}

/**
 * Get all clients for a tenant
 */
export async function getClients(
  tenantId: string
): Promise<ActionResult<Client[]>> {
  try {
    const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);
    const snapshot = await clientsRef.orderBy("name", "asc").get();

    const clients: Client[] = snapshot.docs.map((doc) => docToClient(doc));

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
    const clientRef = adminDb.doc(`tenants/${tenantId}/clients/${clientId}`);
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      return { success: false, error: "Client not found" };
    }

    const client = docToClient(clientDoc);

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
    // Validate shortcode if provided
    if (data.shortcode) {
      const { validateShortcode } = await import("@/lib/invoice-utils");
      if (!validateShortcode(data.shortcode)) {
        return {
          success: false,
          error: "Shortcode must be exactly 4 uppercase letters (e.g., QNTS)",
        };
      }

      // Check uniqueness within tenant
      const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);
      const existingClient = await clientsRef
        .where("shortcode", "==", data.shortcode.toUpperCase())
        .limit(1)
        .get();

      if (!existingClient.empty) {
        return {
          success: false,
          error: `Shortcode "${data.shortcode}" is already in use`,
        };
      }
    }

    const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);

    const newClient = {
      ...data,
      shortcode: data.shortcode?.toUpperCase() || undefined,
      tenantId,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await clientsRef.add(newClient);

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
    // Validate shortcode if being updated
    if (data.shortcode !== undefined) {
      if (data.shortcode) {
        const { validateShortcode } = await import("@/lib/invoice-utils");
        if (!validateShortcode(data.shortcode)) {
          return {
            success: false,
            error: "Shortcode must be exactly 4 uppercase letters (e.g., QNTS)",
          };
        }

        // Check uniqueness (excluding current client)
        const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);
        const existingClient = await clientsRef
          .where("shortcode", "==", data.shortcode.toUpperCase())
          .limit(1)
          .get();

        if (!existingClient.empty && existingClient.docs[0].id !== clientId) {
          return {
            success: false,
            error: `Shortcode "${data.shortcode}" is already in use`,
          };
        }
      }
      data.shortcode = data.shortcode?.toUpperCase() || undefined;
    }

    const clientRef = adminDb.doc(`tenants/${tenantId}/clients/${clientId}`);

    const updateData = {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await clientRef.update(updateData);

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
    const clientRef = adminDb.doc(`tenants/${tenantId}/clients/${clientId}`);
    await clientRef.delete();

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
    const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);
    const snapshot = await clientsRef.get();

    const searchLower = searchTerm.toLowerCase();
    const clients: Client[] = snapshot.docs
      .map((doc) => docToClient(doc))
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
