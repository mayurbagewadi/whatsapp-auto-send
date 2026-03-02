import { Chrome, Play } from "lucide-react";

const CHROME_STORE_URL = "#";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Copy */}
        <div>
          <h1
            className="text-4xl md:text-5xl lg:text-[42px] font-bold leading-[1.2] tracking-tight opacity-0 animate-fade-up"
            style={{ animationDelay: "0.1s" }}
          >
            Send 1000+ WhatsApp Messages{" "}
            <span className="text-gradient">in Minutes, Not Hours</span>
          </h1>
          <p
            className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg opacity-0 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            Enterprise-grade bulk messaging automation. No API keys. No rate limits. Just results.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 opacity-0 animate-fade-up" style={{ animationDelay: "0.5s" }}>
            <a
              href={CHROME_STORE_URL}
              className="gradient-cta text-primary-foreground font-semibold px-8 py-4 rounded-[var(--radius)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform glow-cyan"
            >
              <Chrome size={20} /> Add to Chrome — It's Free
            </a>
            <a
              href="#how-it-works"
              className="border-2 border-border text-foreground font-semibold px-8 py-4 rounded-[var(--radius)] flex items-center justify-center gap-2 hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Play size={18} /> See How It Works
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground opacity-0 animate-fade-up" style={{ animationDelay: "0.7s" }}>
            ✓ Free forever plan &nbsp; ✓ No signup required &nbsp; ✓ 5-second install
          </p>
        </div>

        {/* Hero visual — animated extension mockup */}
        <div className="opacity-0 animate-fade-up" style={{ animationDelay: "0.6s" }}>
          <div className="relative animate-float">
            <div className="bg-card border border-border rounded-none p-6 space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <div className="w-3 h-3 rounded-full bg-orange" />
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-xs text-muted-foreground font-mono ml-2">WasappBulk v2.1</span>
              </div>
              {/* Simulated rows */}
              {[
                { num: "+91 98765 43210", status: "Sent ✓", color: "text-primary" },
                { num: "+1 555 012 3456", status: "Sent ✓", color: "text-primary" },
                { num: "+44 7911 123456", status: "Sending...", color: "text-orange" },
                { num: "+55 11 91234 5678", status: "Queued", color: "text-muted-foreground" },
              ].map((r, i) => (
                <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-border/50 last:border-0">
                  <span className="font-mono text-foreground/80">{r.num}</span>
                  <span className={`font-mono text-xs ${r.color}`}>{r.status}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs text-muted-foreground pt-2">
                <span>4 contacts loaded</span>
                <span className="text-primary font-semibold">2/4 sent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
