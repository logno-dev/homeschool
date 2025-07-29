'use client'

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession()
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            DVCLC
          </h1>
          <h2 className="text-xl md:text-2xl text-gray-700 mb-8">
            Homeschool Cooperative Management System
          </h2>
          <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
            Streamline your homeschool cooperative with our comprehensive platform for 
            student registration, teacher management, class scheduling, fee tracking, and activity monitoring.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!session && (
              <Link
                href="/signin"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Sign In / Register
              </Link>
            )}
            <Link
              href="/about"
              className="border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
            >
              Learn More
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-indigo-600 text-3xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Student Management</h3>
            <p className="text-gray-600">
              Easily register and manage student information, track enrollment, and monitor progress.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-indigo-600 text-3xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Class Scheduling</h3>
            <p className="text-gray-600">
              Create and manage class schedules, assign teachers, and track attendance.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-indigo-600 text-3xl mb-4">💰</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Fee Tracking</h3>
            <p className="text-gray-600">
              Monitor payments, track outstanding fees, and generate financial reports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}