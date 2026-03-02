import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for getting started",
    features: ["50 messages/day", "CSV import", "Message templates", "Basic support"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    desc: "For growing businesses",
    features: ["1,000 messages/day", "Unlimited templates", "Priority queue", "Success tracking", "Priority support"],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large-scale operations",
    features: ["Unlimited messages", "Dedicated support", "Custom delays", "API access", "Team accounts", "SLA guarantee"],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-[32px] font-bold text-center tracking-tight">
          Simple, <span className="text-gradient">Transparent</span> Pricing
        </h2>
        <p className="text-muted-foreground text-center mt-4">Start free. Scale when you're ready.</p>

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative border rounded-none p-8 flex flex-col ${
                p.highlighted
                  ? "border-primary bg-card glow-cyan"
                  : "border-border bg-card hover:border-primary/30"
              } transition-all`}
            >
              {p.highlighted && (
                <span className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-[var(--radius)] font-mono">
                  MOST POPULAR
                </span>
              )}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold font-mono">{p.price}</span>
                <span className="text-muted-foreground text-sm">{p.period}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{p.desc}</p>
              <ul className="mt-8 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check size={16} className="text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className={`mt-8 block text-center font-semibold py-3 rounded-[var(--radius)] transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  p.highlighted
                    ? "gradient-cta text-primary-foreground"
                    : "border-2 border-border text-foreground hover:border-primary/50"
                }`}
              >
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
