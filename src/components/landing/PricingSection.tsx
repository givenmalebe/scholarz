import React from 'react';
import { Check, Star, Award, Users, Bot, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export function PricingSection() {
  const navigate = useNavigate();

  const smeFreeFeatures = [
    "Basic profile listing",
    "Up to 3 engagements/month",
    "Direct messaging",
    "Document sharing",
    "Standard support"
  ];

  const smeCommonFeatures = [
    "Profile listing",
    "Unlimited applications",
    "Direct messaging",
    "Document sharing",
    "Performance analytics",
    "SETA registration check",
    "Dedicated support",
    "Personal AI Advisor & Helper"
  ];

  const smePlans = [
    {
      id: "sme-free",
      name: "Free Trial",
      price: "R0",
      period: "30 days",
      description: "Try the platform risk-free",
      features: smeFreeFeatures,
      noAI: true,
      popular: false,
      cta: "Start Free Trial"
    },
    {
      id: "sme-monthly",
      name: "SME Monthly",
      price: "R99",
      period: "per month",
      description: "Essentials for growing SMEs",
      features: smeCommonFeatures,
      popular: false,
      cta: "Start Monthly"
    },
    {
      id: "sme-annual",
      name: "SME Annual",
      price: "R999",
      period: "per year",
      description: "Best value for committed SMEs",
      features: smeCommonFeatures,
      popular: true,
      cta: "Choose Annual"
    }
  ];

  const sdpFreeFeatures = [
    "Search up to 10 SMEs",
    "Basic SME profiles view",
    "Company profile setup",
    "Up to 2 engagements/month",
    "Standard support"
  ];

  const sdpCommonFeatures = [
    "Unlimited SME searches",
    "Accreditation verification",
    "SETA alignment check",
    "Company profile setup",
    "Verification badge",
    "Onboarding support",
    "Access to list of vendors",
    "Personal AI Advisor & Helper"
  ];

  const sdpPlans = [
    {
      id: "sdp-free",
      name: "Free Trial",
      price: "R0",
      period: "30 days",
      description: "Try the platform risk-free",
      features: sdpFreeFeatures,
      noAI: true,
      popular: false,
      cta: "Start Free Trial"
    },
    {
      id: "sdp-monthly",
      name: "SDP Monthly",
      price: "R149",
      originalPrice: "R299",
      period: "per month",
      description: "Introductory offer: R149/month for first 3 months, then R299/month",
      features: sdpCommonFeatures,
      popular: false,
      cta: "Start Monthly",
      savings: "First 3 months at R149"
    },
    {
      id: "sdp-annual",
      name: "SDP Annual",
      price: "R2,499",
      originalPrice: "R2,899",
      period: "per year",
      description: "First year discount! Save R400 off regular annual price",
      features: sdpCommonFeatures,
      popular: true,
      cta: "Choose Annual",
      savings: "Save R400 (first year only)"
    }
  ];

  const handlePlanSelect = (planId: string, userType: 'sme' | 'sdp') => {
    // Navigate to registration with plan selection
    if (userType === 'sme') {
      navigate('/register/sme', { state: { selectedPlan: planId } });
    } else {
      navigate('/register/sdp', { state: { selectedPlan: planId } });
    }
  };

  const PricingCard = ({ plan, type }: { plan: any; type: 'sme' | 'sdp' }) => (
    <div className={`relative bg-white rounded-3xl shadow-xl border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
      plan.popular ? 'border-blue-500 transform scale-105 bg-gradient-to-br from-blue-50 to-white' : 'border-gray-200 hover:border-blue-300'
    }`}>
      {/* No side panel; lifetime is its own card */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Badge variant="info" className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-green-500 text-white">
            <Star className="w-3 h-3" />
            <span>Most Popular</span>
          </Badge>
        </div>
      )}
      
      <div className="p-8">
        <div className="text-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
          <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
          
          <div className="mb-4">
            <div className="flex items-center justify-center space-x-2">
              {plan.originalPrice && (
                <span className="text-sm text-gray-400 line-through">{plan.originalPrice}</span>
              )}
              <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
              <span className="text-gray-600 text-sm">/{plan.period}</span>
            </div>
            {/* Lifetime alternative not shown here */}
            {plan.savings && (
              <div className="text-green-600 text-sm font-medium mt-1">{plan.savings}</div>
            )}
          </div>
        </div>

        <ul className="space-y-3 mb-6">
          {plan.features.map((feature: string, index: number) => (
            <li key={index} className="flex items-center space-x-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-700 text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {/* AI Advisor Status */}
        {plan.noAI ? (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-2 text-gray-500">
              <X className="w-4 h-4" />
              <span className="text-xs font-medium">No AI Advisor included</span>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 text-blue-700">
              <Bot className="w-4 h-4" />
              <span className="text-xs font-medium">Personal AI Advisor & Helper included</span>
            </div>
          </div>
        )}

        <Button 
          variant={plan.popular ? 'primary' : 'outline'} 
          className="w-full"
          size="lg"
          onClick={() => handlePlanSelect(plan.id, type)}
        >
          {plan.cta}
        </Button>
      </div>
    </div>
  );

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 via-blue-50 to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Simple, affordable pricing designed for the South African skills development industry.
            No hidden fees, no surprises.
          </p>
        </div>

        {/* SME Pricing */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">For Subject Matter Experts</h3>
            <p className="text-gray-600">Start earning with verified credentials and professional listings</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {smePlans.map((plan, index) => (
              <PricingCard key={index} plan={plan} type="sme" />
            ))}
          </div>
        </div>

        {/* SDP Pricing */}
        <div>
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">For Skills Development Providers</h3>
            <p className="text-gray-600">Connect with qualified SMEs and manage your training programs</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {sdpPlans.map((plan, index) => (
              <PricingCard key={index} plan={plan} type="sdp" />
            ))}
          </div>
        </div>

        {/* Engagement Pricing */}
         <div className="mt-16 bg-gradient-to-br from-white to-blue-50 rounded-3xl shadow-2xl p-8 ring-4 ring-white/20">
           <div className="text-center mb-6">
             <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">Engagement Pricing</h3>
             <p className="text-gray-600">Pay-per-engagement for accreditation services</p>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mb-6">
             <div className="text-center p-6 bg-white rounded-xl shadow-md border-2 border-blue-100">
               <div className="text-3xl font-bold text-blue-600 mb-2">R2,500</div>
               <div className="text-sm font-semibold text-gray-900 mb-2">SME Service Fee</div>
               <div className="text-xs text-gray-600">
                 Paid directly to the SME for services such as:<br/>
                 Assessment, Facilitation, Moderation,<br/>
                 or other accreditation support services
               </div>
             </div>
             <div className="text-center">
               <div className="text-2xl font-bold text-gray-400">+</div>
             </div>
             <div className="text-center p-6 bg-white rounded-xl shadow-md border-2 border-green-100">
               <div className="text-3xl font-bold text-green-600 mb-2">10%</div>
               <div className="text-sm font-semibold text-gray-900 mb-2">Platform Fee</div>
               <div className="text-xs text-gray-600">
                 Covers payment processing, escrow protection,<br/>
                 document management, and support services
               </div>
             </div>
           </div>
           
           <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
             <div className="text-center">
               <p className="text-sm font-medium text-gray-900 mb-2">
                 How Engagement Pricing Works
               </p>
               <p className="text-sm text-gray-700 leading-relaxed max-w-3xl mx-auto">
                 When an SDP engages an SME for accreditation services, <strong>R2,500 is paid directly to the SME</strong> for their professional services (assessment, facilitation, moderation, etc.). An additional 10% platform fee (R250) ensures secure payment processing through our escrow system, comprehensive document management, and dedicated support throughout the engagement.
               </p>
             </div>
           </div>
         </div>
      </div>
    </section>
  );
}