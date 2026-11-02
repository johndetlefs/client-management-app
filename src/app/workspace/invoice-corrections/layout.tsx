import { Suspense } from "react";
export const runtime = "nodejs";
export default function CorrectionLayout({children}:{children:React.ReactNode}) { return <Suspense fallback={<p>Loading corrections…</p>}>{children}</Suspense>; }
