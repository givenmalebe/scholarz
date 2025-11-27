import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCircle, 
  ArrowRight, 
  Award, 
  Users, 
  DollarSign, 
  Clock,
  FileText,
  Shield,
  Star,
  Briefcase
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function SMEGateway() {
  const requirements = [
    {
      icon: <Award className="w-6 h-6" />,
      title: "SETA Registration",
      description: "Current registration with relevant SETA (ETDP, HWSETA, MICT, etc.)",
      status: "required"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Relevant Qualifications",
      description: "Appropriate qualifications for your area of expertise",
      status: "required"
    },
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: "Professional Experience",
      description: "Minimum 2 years experience in skills development or related field",
      status: "required"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Valid ID Document",
      description: "South African ID or work permit for verification",
      status: "required"
    }
  ];

  const roles = [
    {
      title: "Facilitator",
      description: "Deliver training programs and facilitate learning experiences",
      averageRate: "R2,500",
      demand: "High",
      icon: <Users className="w-8 h-8" />
    },
    {
      title: "Assessor",
      description: "Conduct competency assessments and evaluations",
      averageRate: "R2,500",
      demand: "Very High",
      icon: <CheckCircle className="w-8 h-8" />
    },
    {
      title: "Moderator",
      description: "Quality assure assessments and maintain standards",
      averageRate: "R2,500",
      demand: "Medium",
      icon: <Star className="w-8 h-8" />
    },
    {
      title: "Consultant",
      description: "Provide strategic guidance and specialized expertise",
      averageRate: "R2,500",
      demand: "Medium",
      icon: <Briefcase className="w-8 h-8" />
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Register",
      description: "Complete your SME profile with qualifications and experience"
    },
    {
      number: "2",
      title: "Verify",
      description: "Submit documents for SETA verification (R100 fee)"
    },
    {
      number: "3",
      title: "Subscribe",
      description: "Choose monthly (R69) or annual (R699) listing subscription"
    },
    {
      number: "4",
      title: "Connect",
      description: "Start receiving engagement opportunities from SDPs"
    }
  ];

  const testimonials = [
    {
      name: "Dr. Sarah Ndlovu",
      role: "Skills Development Consultant",
      image: "/images/profile-2.jpg",
      quote: "Scholarz has transformed my practice. I've connected with quality SDPs and my income has increased by 40% in just 6 months.",
      rating: 5
    },
    {
      name: "Mr. James Roberts",
      role: "Technical Assessor",
      image: "/images/profile-3.jpg",
      quote: "The platform makes it easy to find legitimate opportunities. The verification process gives both parties confidence.",
      rating: 5
    }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-50 via-white to-blue-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Become a 
            <span className="text-green-600"> Verified SME</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Join South Africa's premier platform for skills development professionals. 
            Connect with accredited training providers through Scholarz.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register/sme">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                Start Your SME Journey
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 max-w-3xl mx-auto mb-12">
            <p className="text-center text-gray-700 mb-4">
              <strong className="text-blue-900">Standard Engagement Fee: R2,500 (minimum)</strong>
            </p>
            <p className="text-sm text-center text-gray-600">
              A 10% platform fee is deducted from every engagement. For a R2,500 engagement, you receive R2,250. All verified SMEs operate under a transparent, standardized engagement fee structure for consistency and fairness.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">500+</div>
              <div className="text-gray-600">Verified SMEs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">150+</div>
              <div className="text-gray-600">Partner SDPs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">R2.1M+</div>
              <div className="text-gray-600">Paid to SMEs</div>
            </div>
          </div>
        </div>
      </section>

      {/* SME Roles */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              SME Opportunities
            </h2>
            <p className="text-xl text-gray-600">
              Explore the different roles available on our platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
                <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-4">
                  {role.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{role.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{role.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Minimum Fee:</span>
                    <span className="font-medium text-gray-900">{role.averageRate}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    (10% platform fee deducted)
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Demand:</span>
                    <Badge 
                      variant={
                        role.demand === 'Very High' ? 'success' :
                        role.demand === 'High' ? 'info' : 'warning'
                      }
                      size="sm"
                    >
                      {role.demand}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              SME Requirements
            </h2>
            <p className="text-xl text-gray-600">
              Ensure you meet these requirements before starting your application
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {requirements.map((requirement, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                  {requirement.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {requirement.title}
                  </h3>
                  <p className="text-gray-600">{requirement.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Getting Started is Easy
            </h2>
            <p className="text-xl text-gray-600">
              Follow these simple steps to join the Scholarz community
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
                
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-blue-200"></div>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link to="/register/sme">
              <Button size="lg">
                Start Your SME Journey
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Success Stories
            </h2>
            <p className="text-xl text-gray-600">
              Hear from SMEs who have transformed their careers with Scholarz
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-8">
                <div className="flex items-center space-x-4 mb-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900">{testimonial.name}</h4>
                    <p className="text-gray-600 text-sm">{testimonial.role}</p>
                    <div className="flex space-x-1 mt-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <blockquote className="text-gray-700 italic">
                  "{testimonial.quote}"
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your SME Journey?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of verified SMEs earning through quality engagements on Scholarz
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/sme">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto bg-white text-blue-600 hover:bg-gray-100">
                Register Now
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white hover:text-blue-600">
              Contact Support
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
}