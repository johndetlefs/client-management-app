import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-20 md:py-32">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Simplify Your Client Management & Invoicing
          </h1>
          <p className="text-lg md:text-xl text-foreground/70 mb-10 max-w-2xl mx-auto">
            ClientFlow helps businesses manage clients, track billable work, and generate professional invoices—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Get Started Free</Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full sm:w-auto">Sign In</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-foreground/10 bg-foreground/[0.02] px-4 py-20">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Everything You Need to Run Your Business
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="flex flex-col items-center text-center p-6">
              <div className="mb-4 p-3 rounded-full bg-foreground/5">
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Client Management</h3>
              <p className="text-foreground/70">
                Keep all your client information organized and accessible in one central location.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex flex-col items-center text-center p-6">
              <div className="mb-4 p-3 rounded-full bg-foreground/5">
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M9 3v18" />
                  <path d="M9 9h6" />
                  <path d="M9 15h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Job Tracking</h3>
              <p className="text-foreground/70">
                Track projects and billable items with flexible hourly, daily, or unit-based pricing.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex flex-col items-center text-center p-6">
              <div className="mb-4 p-3 rounded-full bg-foreground/5">
                <svg
                  className="h-8 w-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Professional Invoices</h3>
              <p className="text-foreground/70">
                Generate polished invoices with automatic numbering and secure payment tracking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-foreground/10 px-4 py-20">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-foreground/70 mb-8">
            Join businesses already streamlining their operations with ClientFlow.
          </p>
          <Link href="/signup">
            <Button>Create Your Free Account</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 px-4 py-8 mt-auto">
        <div className="container max-w-6xl mx-auto text-center text-sm text-foreground/60">
          <p>&copy; {new Date().getFullYear()} ClientFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
