import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import HowItWorks from "@/components/HowItWorks";
import PricingSection from "@/components/PricingSection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

export default function Index() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <FeaturesGrid />
        <HowItWorks />
        <PricingSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
