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
              Desert Valley Creative Learning Collaborative
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                What is DVCLC?
              </h2>
              <p className="text-gray-700 mb-6">
                <strong>Desert Valley Creative Learning Collaborative</strong> is an education support group for homeschoolers that was founded in 2011.  While our leadership and many of our members, share a love for God and Christian faith, everyone is welcome in our learning environment.

              </p>
              <p className="text-gray-700 mb-6">
                It is our desire to  provide a caring, creative learning environment where children can have abundant opportunities to enjoy personal as well as public success.
              </p>
              <p className="text-gray-700 mb-6">
                DVCLC meets on <strong>Mondays</strong> at Grace Chapel in Indio, CA from <strong>9:30 a.m – 2:00 p.m.</strong>
              </p>
               <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3319.4271907655093!2d-116.25494572339673!3d33.69789333635636!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80daf83fbdd65fbb%3A0xcdfe7bb4a72bee6f!2sGrace%20Chapel%20Indio!5e0!3m2!1sen!2sus!4v1785802438531!5m2!1sen!2sus" width="400" height="300" className="mx-auto my-2" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"></iframe>
              <p className="text-gray-700 mb-6">
                Co-op is a unique, parent-led program that offers students a full day of classes, with a variety of choices to enrich the lives of your students. We have found that when parents are able to teach things that they love and are interested in, they bless our students with amazingly creative classes! We offer both academic and elective classes, at 50 minutes per class, along with a 1 hour lunch break. Students can take as many as four classes per session, but are not required to attend the full day.  Our Pre-K/Kindergarten group follows a slightly different schedule to meet their needs. At least one parent from each family is required to actively participate throughout the entire co-op day by volunteering each hour in one of our many volunteer positions. This is the only way we have found to make this type of co-op work efficiently and enjoyably for all involved.
              </p>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Learning groups are broken down as follows (these are just suggestions – you can work with the leaders of these age groups to figure out a good fit for your child):
              </h2>

              <div className="grid grid-cols-1 max-w-lg gap-6 mb-8 mx-auto">
                <div className="bg-blue-50 p-6 rounded-lg mx-auto">
                  <p className="text-blue-800 font-bold">
                    Early Elementary (K-2nd grade)
                  </p>
                </div>

                <div className="bg-green-50 p-6 rounded-lg mx-auto">
                  <p className="text-green-800 font-bold">
                    Late Elementary (3rd-5th grade)
                  </p>
                </div>

                <div className="bg-purple-50 p-6 rounded-lg mx-auto">
                  <p className="text-purple-800 font-bold">
                    Middle/High School (6th-12th grade)
                  </p>
                </div>

              </div>


              <p className="text-gray-700 mb-4 italic">
                We serve the Coachella Valley (Indio, La Quinta, Palm Desert, Palm Springs, Cathedral City, Rancho Mirage, Desert Hot Springs), as well as surrounding areas.
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
