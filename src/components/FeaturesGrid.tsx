import { Zap, Shield, Smartphone, Settings, BarChart3, FileText, Upload, CheckCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const features = [
  { icon: Zap, title: "Instant Sending", desc: "Send bulk messages in under 5 minutes" },
  { icon: Shield, title: "Privacy First", desc: "Messages stay in your control. No logs stored." },
  { icon: Smartphone, title: "Works Everywhere", desc: "Desktop + Mobile browsers supported" },
  { icon: Settings, title: "No API Keys Needed", desc: "Uses WhatsApp Web. Zero config required." },
  { icon: BarChart3, title: "Smart Queuing", desc: "Prevents rate limits with intelligent auto-delays" },
  { icon: FileText, title: "Message Templates", desc: "Save and reuse your bulk message templates" },
  { icon: Upload, title: "CSV Import", desc: "Upload thousands of contacts instantly" },
  { icon: CheckCircle, title: "Success Tracking", desc: "Know exactly which messages were delivered" },
];

export default function FeaturesGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 md:py-32" ref={ref}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-3xl md:text-[32px] font-bold text-center tracking-tight">
          Everything You Need to <span className="text-gradient">Send at Scale</span>
        </h2>
        <p className="text-muted-foreground text-center mt-4 max-w-xl mx-auto">
          Built for marketers, support teams, and businesses who need reliable bulk messaging.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`bg-card border border-border p-6 rounded-none hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 group ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: visible ? `${i * 80}ms` : "0ms" }}
            >
              <f.icon className="text-primary mb-4 group-hover:scale-110 transition-transform" size={28} />
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
