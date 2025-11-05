'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface WorkspaceContextType {
    tenantId: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({
    tenantId,
    children,
}: {
    tenantId: string;
    children: ReactNode;
}) {
    return (
        <WorkspaceContext.Provider value={{ tenantId }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
