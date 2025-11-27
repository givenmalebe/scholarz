import React from 'react';
import { Layout } from '../components/layout/Layout';
import { PricingSection } from '../components/landing/PricingSection';
import { TrustSection } from '../components/landing/TrustSection';

export function PricingPage() {
  return (
    <Layout>
      <div className="bg-white pt-16 pb-8">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600">
            Choose the plan that works for you. No hidden fees, no surprises.
          </p>
        </div>
      </div>
      
      <PricingSection />
      
      <div className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Questions about pricing?
          </h2>
          <p className="text-gray-600 mb-6">
            Our team is here to help you choose the right plan for your needs.
          </p>
          <a 
            href="mailto:support@edulinker.co.za"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </Layout>
  );
}