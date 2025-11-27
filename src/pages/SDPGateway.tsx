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
  Briefcase,
  Building2,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function SDPGateway() {
  const benefits = [
    {
      title: "Access Quality SMEs",
      description: "Connect with verified Subject Matter Experts for your training programs",
      icon: <Users className="w-8 h-8" />,
      color: "blue"
    },
    {
      title: "Streamline Operations",
      description: "Efficient engagement process with standardized R2,500 minimum fee per engagement (10% platform fee deducted from SME payment)",
      icon: <Clock className="w-8 h-8" />,
      color: "green"
    },
    {
      title: "Verified Experts",
      description: "Work with certified and qualified SMEs across all sectors",
      icon: <CheckCircle className="w-8 h-8" />,
      color: "purple"
    },
    {
      title: "Transparent Pricing",
      description: "Predictable engagement costs with no hidden fees or negotiations",
      icon: <DollarSign className="w-8 h-8" />,
      color: "yellow"
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Tell Us About Yourself",
      description: "Share your training goals and accreditation needs"
    },
    {
      number: "2",
      title: "Get Matched",
      description: "Our AI Manager will connect with you to understand your specific requirements"
    },
    {
      number: "3",
      title: "Receive Support",
      description: "Get personalized guidance and help with your accreditation process"
    },
    {
      number: "4",
      title: "Start Engaging",
      description: "Access verified SMEs and begin your training programs"
    }
  ];

  const testimonials = [
    {
      name: "Skills Development Institute",
      role: "ETDP Accredited Training Provider",
      image: "/images/profile-1.jpg",
      quote: "Scholarz has transformed how we source qualified SMEs. The platform's transparency and quality of experts is unmatched. We've seen a 35% improvement in our program completion rates.",
      rating: 5
    },
    {
      name: "TechAdvance Training",
      role: "MICT SETA Accredited",
      image: "/images/profile-3.jpg",
      quote: "Finding qualified assessors and moderators was always a challenge. Scholarz has made this seamless with their verified network and standardized pricing.",
      rating: 5
    }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-green-50 pt-16 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Become a 
            <span className="text-blue-600"> Verified SDP</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Join South Africa's premier platform connecting accredited Skills Development Providers 
            with verified Subject Matter Experts. Access quality facilitators, assessors, and moderators.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/register/sdp">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                Start Your SDP Journey
                <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </Link>
          </div>
          
          <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-6 max-w-3xl mx-auto mb-12">
            <p className="text-center text-gray-700 mb-4">
              <strong className="text-blue-900">Standard Engagement Fee: R2,500 (minimum)</strong>
            </p>
            <p className="text-sm text-center text-gray-600">
              A 10% platform fee is deducted from every engagement payment to the SME. For a R2,500 engagement, the SME receives R2,250. All engagements operate under a transparent, standardized fee structure for consistency and fairness.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">156+</div>
              <div className="text-gray-600">Verified SDPs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">847+</div>
              <div className="text-gray-600">Available SMEs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">R890K+</div>
              <div className="text-gray-600">Engagement Value</div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Partner with Us
            </h2>
            <p className="text-xl text-gray-600">
              Discover the benefits of joining the Scholarz platform
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
                <div className={`w-16 h-16 bg-${benefit.color}-100 rounded-xl flex items-center justify-center text-${benefit.color}-600 mb-4`}>
                  {benefit.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
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
              We'll help you every step of the way with personalized support
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
            <Link to="/register/sdp">
              <Button size="lg">
                Start Your SDP Journey
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
              Hear from SDPs who have transformed their training delivery with Scholarz
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
            Ready to Enhance Your Training Programs?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join our network of accredited SDPs accessing quality verified SMEs through Scholarz
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register/sdp">
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

