import React from 'react';
import { Shield, Lock, Award, FileCheck, Users, CheckCircle } from 'lucide-react';

export function TrustSection() {
  const trustFeatures = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "SETA Compliance",
      description: "All SMEs are verified against SETA registrations and qualifications databases."
    },
    {
      icon: <Lock className="w-8 h-8" />,
      title: "GDPR/POPIA Compliant",
      description: "Your data is protected according to South African and international privacy laws."
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "Quality Assurance",
      description: "Rigorous verification process ensures only qualified professionals join our platform."
    },
    {
      icon: <FileCheck className="w-8 h-8" />,
      title: "Secure Documentation",
      description: "End-to-end encryption for all documents shared between SDPs and SMEs."
    }
  ];

  const verificationSteps = [
    {
      step: "1",
      title: "Document Submission",
      description: "Upload SETA registration, qualifications, and ID documents"
    },
    {
      step: "2",
      title: "SETA Verification",
      description: "We verify credentials directly with relevant SETA databases"
    },
    {
      step: "3",
      title: "Quality Review",
      description: "Our team reviews experience and professional references"
    },
    {
      step: "4",
      title: "Profile Approval",
      description: "Verified badge added and profile goes live on the platform"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 to-green-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Features */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-lg rounded-full px-4 py-2 mb-6">
            <Shield className="w-5 h-5 text-white" />
            <span className="text-sm font-semibold text-white">Trust & Security</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-extrabold text-white mb-6">
            Trust & Security First
          </h2>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto mb-12">
            Built on a foundation of trust, compliance, and security. 
            Every interaction is safe, verified, and professional.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {trustFeatures.map((feature, index) => (
            <div key={index} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center hover:bg-white/20 transition-all">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-blue-100 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Verification Process */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 lg:p-12 border border-white/20">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-4">
              Our Verification Process
            </h3>
            <p className="text-lg text-blue-100">
              Every SME goes through comprehensive verification for quality and compliance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {verificationSteps.map((step, index) => (
              <div key={index} className="relative bg-white rounded-2xl p-6 hover:shadow-xl transition-shadow">
                <div className="text-center">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    {step.step}
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h4>
                  <p className="text-gray-600 text-sm">{step.description}</p>
                </div>
                
                {index < verificationSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 -right-3 w-6 h-0.5 bg-white/30"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="flex items-center justify-center mb-3">
              <Users className="w-10 h-10 text-white mr-3" />
              <span className="text-4xl font-bold text-white">847+</span>
            </div>
            <p className="text-blue-100 text-sm font-medium">Verified SMEs</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="flex items-center justify-center mb-3">
              <CheckCircle className="w-10 h-10 text-green-300 mr-3" />
              <span className="text-4xl font-bold text-white">95%</span>
            </div>
            <p className="text-blue-100 text-sm font-medium">Success Rate</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <div className="flex items-center justify-center mb-3">
              <Award className="w-10 h-10 text-yellow-300 mr-3" />
              <span className="text-4xl font-bold text-white">24h</span>
            </div>
            <p className="text-blue-100 text-sm font-medium">Avg Verification</p>
          </div>
        </div>
      </div>
    </section>
  );
}