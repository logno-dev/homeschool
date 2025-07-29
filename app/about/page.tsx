'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function About() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              About DVCLC
            </h1>
            <p className="text-xl text-gray-700">
              Your comprehensive homeschool cooperative management solution
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                What is DVCLC?
              </h2>
              <p className="text-gray-700 mb-6">
                DVCLC (Delaware Valley Christian Learning Cooperative) Management System is a comprehensive 
                platform designed specifically for homeschool cooperatives. Our system streamlines the 
                complex tasks of managing students, teachers, classes, schedules, and finances in one 
                integrated solution.
              </p>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Key Features
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">👥 Student Management</h3>
                  <p className="text-blue-800">
                    Comprehensive student profiles, enrollment tracking, grade management, and progress monitoring.
                  </p>
                </div>
                
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-900 mb-2">👨‍🏫 Teacher Portal</h3>
                  <p className="text-green-800">
                    Dedicated teacher dashboard for class management, schedule review, and teaching requests.
                  </p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">📚 Class Scheduling</h3>
                  <p className="text-purple-800">
                    Flexible class scheduling system with room assignments, time slots, and conflict resolution.
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">💰 Fee Management</h3>
                  <p className="text-yellow-800">
                    Automated fee calculation, payment tracking, and financial reporting for families and administrators.
                  </p>
                </div>
                
                <div className="bg-red-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">🤝 Volunteer Coordination</h3>
                  <p className="text-red-800">
                    Volunteer job management, hour tracking, and assignment coordination for cooperative activities.
                  </p>
                </div>
                
                <div className="bg-indigo-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-2">📊 Admin Dashboard</h3>
                  <p className="text-indigo-800">
                    Comprehensive administrative tools for user management, system configuration, and reporting.
                  </p>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Who Can Use DVCLC?
              </h2>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-semibold">👨‍👩‍👧‍👦</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Families</h4>
                    <p className="text-gray-700">Register children for classes, manage payments, track volunteer hours, and stay updated on schedules.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-green-600 font-semibold">👨‍🏫</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Teachers</h4>
                    <p className="text-gray-700">Submit teaching requests, review class schedules, and manage classroom assignments.</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                    <span className="text-purple-600 font-semibold">⚙️</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Administrators</h4>
                    <p className="text-gray-700">Oversee all aspects of the cooperative including user management, scheduling, and financial oversight.</p>
                  </div>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Getting Started
              </h2>
              <p className="text-gray-700 mb-4">
                Ready to streamline your homeschool cooperative management? Contact your cooperative 
                administrator to get your account set up, or if you're an administrator looking to 
                implement DVCLC for your cooperative, reach out to learn more about setup and training.
              </p>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => router.push('/')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              Back to Home
            </button>
            <Link
              href="/signin"
              className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              Sign In / Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}