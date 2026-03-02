import { Link } from "react-router-dom";
import Header from "@/components/Header";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-8xl md:text-9xl font-bold font-mono text-gradient">404</h1>
          <p className="text-xl text-muted-foreground mt-4">This page got lost in the queue.</p>
          <Link
            to="/"
            className="inline-block mt-8 gradient-cta text-primary-foreground font-semibold px-8 py-4 rounded-[var(--radius)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </>
  );
}
