import React from 'react';
import { HeroSection } from '../components/landing/HeroSection';
import { BenefitsSection } from '../components/landing/BenefitsSection';
import { PricingSection } from '../components/landing/PricingSection';
import { TrustSection } from '../components/landing/TrustSection';
import { Layout } from '../components/layout/Layout';

export function LandingPage() {
  return (
    <Layout>
      <HeroSection />
      <BenefitsSection />
      <TrustSection />
      <PricingSection />
    </Layout>
  );
}