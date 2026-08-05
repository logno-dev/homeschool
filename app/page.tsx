'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-client'
import BrandLogo from '@/app/components/BrandLogo'

export default function Home() {
  const { user, loading } = useAuth()

  const valueCards = [
    {
      title: 'Flexible Class Blocks',
      description:
        'Students move through a full-day schedule with small-group academic and elective sessions designed to match different interests and learning speeds.',
      image: '/images/about-students.jpg',
      imageAlt: 'Students collaborating on creative classroom projects',
    },
    {
      title: 'Parent-Led Excellence',
      description:
        'Families teach and support what they love, bringing real-world skills and unique passions into an academically grounded homeschool environment.',
      image: '/images/about-creative.jpg',
      imageAlt: 'Close-up of a parent helping a student in class',
    },
    {
      title: 'Community That Matters',
      description:
        'Volunteer opportunities, friendly support, and shared leadership create structure and connection so every family can contribute meaningfully.',
      image: '/images/about-community.jpg',
      imageAlt: 'Students and adults gathering in a bright learning community',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto max-w-7xl px-4 py-12 md:py-20">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div>
            <div className="mx-auto mb-6 flex justify-center md:justify-start">
              <BrandLogo variant="horizontal" width={320} priority />
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Desert Valley Creative Learning Collaborative
            </p>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              A structured, parent-powered learning pathway
            </h1>
            <p className="mt-6 text-lg text-gray-700 max-w-xl">
              DVCLC is a homeschool collaborative for families who want academics, creativity,
              and social growth balanced into one meaningful day. Students participate in focused classes,
              parents volunteer to support operations, and teams work together so every child receives
              attention and encouragement.
            </p>

            <ul className="mt-8 grid gap-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span>Flexible schedules with core academics and electives.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span>Built-in parent participation and volunteer roles every day.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span>Simple enrollment, scheduling, and payment tools in one place.</span>
              </li>
            </ul>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              {!loading && !user && (
                <>
                  <Link
                    href="/signin"
                    className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
                  >
                    Join the Co-op
                  </Link>
                </>
              )}
              <Link
                href="/about"
                className="inline-flex items-center justify-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
              >
                Learn More
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-white/70 bg-white p-3 shadow-xl shadow-blue-200/40">
              <Image
                src="/images/hero-home.jpg"
                alt="Bright homeschool classroom with students learning together"
                width={1400}
                height={1050}
                className="h-[420px] w-full rounded-2xl object-cover sm:h-[500px]"
                priority
              />
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {valueCards.map((card) => (
            <article key={card.title} className="overflow-hidden rounded-xl border border-white/80 bg-white shadow-sm shadow-blue-100">
              <Image
                src={card.image}
                alt={card.imageAlt}
                width={1200}
                height={900}
                className="h-56 w-full object-cover"
              />
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-3 text-gray-700">{card.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-bold text-gray-900">Why families choose DVCLC</h2>
          <p className="mt-3 text-gray-700">
            Our collaborative supports families who want the structure of a classroom with the care and flexibility of home
            education. You can track schedules, registrations, fees, and communications in a centralized platform
            while students benefit from community-based learning and intentional mentoring.
          </p>
        </section>
      </div>
    </div>
  )
}
