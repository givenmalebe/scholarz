import React from 'react';
import { 
  Users, 
  Shield, 
  Clock, 
  Award, 
  Search, 
  FileCheck, 
  DollarSign, 
  MessageSquare,
  Bot,
  Sparkles
} from 'lucide-react';

export function BenefitsSection() {
  const sdpBenefits = [
    {
      icon: <Search className="w-6 h-6" />,
      title: "Advanced SME Discovery",
      description: "Search and filter qualified SMEs by specialization, sector, location, and availability."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Verified Credentials",
      description: "All SMEs are SETA-registered with verified qualifications and experience."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Streamlined Engagement",
      description: "Simplified process to engage SMEs for training, assessment, and accreditation needs."
    },
    {
      icon: <FileCheck className="w-6 h-6" />,
      title: "Document Management",
      description: "Secure platform for sharing training materials and assessment documentation."
    }
  ];

  const smeBenefits = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Expand Your Network",
      description: "Connect with accredited SDPs across South Africa seeking your expertise."
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: "Showcase Credentials",
      description: "Display your qualifications, experience, and testimonials in a professional profile."
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "Flexible Earning",
      description: "Set your own rates and choose engagements that fit your schedule and expertise."
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Direct Communication",
      description: "Communicate directly with SDPs to discuss project requirements and expectations."
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
            Designed for Success
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Scholarz provides tailored solutions for both Skills Development Providers
            and Subject Matter Experts in the South African skills development ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* SDP Benefits */}
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                For Skills Development Providers
              </h3>
              <p className="text-gray-600 mb-8">
                Find and engage the right SMEs for your training and assessment needs.
              </p>
            </div>
            
            <div className="space-y-6">
              {sdpBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-blue-100">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {benefit.title}
                    </h4>
                    <p className="text-gray-600">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SME Benefits */}
          <div className="space-y-8">
            <div className="text-center lg:text-left">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                For Subject Matter Experts
              </h3>
              <p className="text-gray-600 mb-8">
                Grow your practice by connecting with accredited training providers.
              </p>
            </div>
            
            <div className="space-y-6">
              {smeBenefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 border border-green-100">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {benefit.title}
                    </h4>
                    <p className="text-gray-600">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Advisor Feature Highlight */}
        <div className="mt-16 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 rounded-3xl shadow-2xl p-8 lg:p-12 border-2 border-purple-200">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 via-blue-500 to-green-500 rounded-2xl flex items-center justify-center shadow-xl">
                <Bot className="w-12 h-12 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-3">
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  Your Personal AI Advisor & Helper
                </h3>
                <Sparkles className="w-6 h-6 text-purple-500" />
              </div>
              <p className="text-lg text-gray-700 mb-4">
                Available with all paid plans, your AI advisor provides 24/7 intelligent assistance to help you succeed on the platform.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Smart Recommendations</h4>
                    <p className="text-sm text-gray-600">Get AI-powered suggestions for SMEs, engagements, and opportunities</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Instant Answers</h4>
                    <p className="text-sm text-gray-600">Ask questions about SETA compliance, documentation, or platform features</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Profile Optimization</h4>
                    <p className="text-sm text-gray-600">Receive tips to improve your profile and increase engagement success</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Workflow Automation</h4>
                    <p className="text-sm text-gray-600">Automate routine tasks and get reminders for important deadlines</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 inline-block px-4 py-2 bg-white rounded-full shadow-md border border-purple-200">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold text-purple-600">Note:</span> AI Advisor not included in Free Trial plans
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Collaboration Image */}
         <div className="mt-16">
           <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-4 ring-white/20">
             <img
               src="/images/collaboration.jpg"
               alt="Professional collaboration"
               className="w-full h-64 lg:h-80 object-cover"
             />
             <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-purple-600/80 to-green-600/90 flex items-center justify-center">
               <div className="text-center text-white">
                 <h3 className="text-2xl lg:text-3xl font-bold mb-4">
                   Building Skills Together
                 </h3>
                 <p className="text-lg opacity-90 max-w-2xl">
                   Join a community dedicated to advancing skills development across South Africa
                 </p>
               </div>
             </div>
           </div>
         </div>
      </div>
    </section>
  );
}