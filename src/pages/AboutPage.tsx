import React from 'react';
import { Layout } from '../components/layout/Layout';
import { 
  Users, 
  Award, 
  Target, 
  Heart,
  Shield,
  Globe,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Users2
} from 'lucide-react';

export function AboutPage() {
  const values = [
    {
      icon: <Award className="w-8 h-8" />,
      title: "Quality First",
      description: "We maintain the highest standards through rigorous verification and quality assurance processes."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Trust & Security",
      description: "Every interaction on our platform is secure, verified, and compliant with South African regulations."
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: "Community Focused",
      description: "We're committed to building a supportive community that advances skills development across SA."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Continuous Growth",
      description: "We believe in the power of lifelong learning and continuous professional development."
    }
  ];

  const stats = [
    { number: "500+", label: "Verified SMEs" },
    { number: "150+", label: "Registered SDPs" },
    { number: "2,500+", label: "Learners Impacted" },
    { number: "95%", label: "Success Rate" }
  ];


  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-green-600 pt-24 pb-20 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6">
                About Scholarz
              </h1>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                We're transforming skills development in South Africa by connecting qualified 
                Subject Matter Experts with accredited Skills Development Providers through 
                a trusted, verified platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5" />
                  <span className="text-blue-100">SETA Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-blue-100">Secure Platform</span>
                </div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="text-blue-100">Growing Community</span>
                </div>
              </div>
            </div>
            <div className="lg:mt-0 mt-8">
              <img
                src="/images/Whisk_00c09db6e7e3fa1b1044f1ff43e90b4ddr.jpeg"
                alt="Scholarz Platform"
                className="w-full h-auto rounded-2xl shadow-2xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-blue-600">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Our Mission</h2>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                To bridge the skills gap in South Africa by creating a trusted platform 
                that connects verified Subject Matter Experts with accredited Skills 
                Development Providers, enabling quality training and assessment services 
                that meet industry standards.
              </p>
              <div className="space-y-3 bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 font-medium">SETA-aligned verification</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 font-medium">Quality assurance</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 font-medium">Fair pricing</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-green-600">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Our Vision</h2>
              </div>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                To become South Africa's leading platform for skills development 
                collaboration, empowering every individual to reach their potential 
                while supporting the country's economic growth through quality education 
                and training.
              </p>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <span className="text-gray-700 font-semibold">Transform skills development</span>
                </div>
                <p className="text-sm text-gray-600">
                  Building a more skilled, prosperous South Africa for all.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-8 text-center hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center mx-auto mb-6 shadow-md text-blue-600">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Our Impact
            </h2>
            <p className="text-xl text-blue-100">
              Making a difference in South African skills development
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-5xl font-bold mb-3">{stat.number}</div>
                <div className="text-blue-100 text-lg font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Story
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-600 to-green-600 mx-auto"></div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
            <div className="prose prose-lg mx-auto text-gray-600 space-y-6">
              <p className="text-lg leading-relaxed">
                Scholarz was born from a simple observation: South Africa has incredible 
                talent in skills development, but connecting the right experts with the 
                right opportunities was inefficient and often unreliable.
              </p>
              
              <p className="text-lg leading-relaxed">
                Founded in 2023 by a team of skills development professionals and technology 
                experts, Scholarz set out to solve this challenge. We recognized that both 
                SMEs and SDPs needed a platform that prioritized quality, verification, and 
                professional standards.
              </p>
              
              <p className="text-lg leading-relaxed">
                Today, we're proud to facilitate thousands of successful engagements between 
                verified SMEs and accredited SDPs, contributing to the development of skilled 
                professionals across South Africa. Our platform continues to evolve, driven 
                by feedback from our community and our commitment to excellence.
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-xl border-l-4 border-blue-600 mt-8">
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  We're not just a platform – we're partners
                </p>
                <p className="text-gray-700">
                  We're committed to South Africa's skills development journey, building a more 
                  skilled, prosperous nation for all.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-green-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Users2 className="w-16 h-16 text-white mx-auto mb-4" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Join Our Mission
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Be part of transforming skills development in South Africa
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/sdp-gateway"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Get Started as SDP
              <ArrowRight className="ml-2 w-5 h-5" />
            </a>
            <a 
              href="mailto:info@edulinker.co.za"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white rounded-xl font-semibold hover:bg-white hover:text-blue-600 transition-all duration-300"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </Layout>
  );
}