import Image from 'next/image'
import Link from 'next/link'
import BrandLogo from '@/app/components/BrandLogo'
import { getFaqsByVisibility } from '@/lib/database'

export const dynamic = 'force-dynamic'

const groupCards = [
  {
    label: 'Nursery/Preschool (0-Pre K)',
    image: '/images/bbc-creative-1w20Cysy1cg-unsplash.jpg',
    imageAlt: 'Toy truck in a daycare with children in the backround',
  },
  {
    label: 'Early Elementary (K-2nd grade)',
    image: '/images/gautam-arora-OVDtgUhUPBY-unsplash.jpg',
    imageAlt: 'Early elementary students working together in class',
  },
  {
    label: 'Late Elementary (3rd-5th grade)',
    image: '/images/compagnons-TJxotQTUr8o-unsplash.jpg',
    imageAlt: 'Middle grade students gathering for a creative activity',
  },
  {
    label: 'Middle/High School (6th-12th grade)',
    image: '/images/thought-catalog-505eectW54k-unsplash.jpg',
    imageAlt: 'Students engaged in a focused discussion with mentors',
  },
]

export default async function About() {
  const publicFaqs = await getFaqsByVisibility('public')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto max-w-6xl px-4 py-12 md:py-16">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <BrandLogo variant="horizontal" width={280} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">About DVCLC</h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">
            Desert Valley Creative Learning Collaborative
          </p>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start bg-white rounded-2xl border border-blue-100 p-8 md:p-10 shadow-sm">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">What is DVCLC?</h2>
            <div className="prose prose-lg max-w-none mt-5 space-y-4 text-gray-700">
              <p>
                <strong>Desert Valley Creative Learning Collaborative</strong> is an education support group for
                homeschoolers that was founded in 2011.  While our leadership and many of our members, share a love
                for God and Christian faith, everyone is welcome in our learning environment.
              </p>
              <p>
                It is our desire to  provide a caring, creative learning environment where children can have abundant
                opportunities to enjoy personal as well as public success.
              </p>
              <p>
                DVCLC meets on <strong>Mondays</strong> at Grace Chapel in Indio, CA from <strong>9:30 a.m – 2:00 p.m.</strong>
              </p>
              <p>
                Co-op is a unique, parent-led program that offers students a full day of classes, with a variety of
                choices to enrich the lives of your students. We have found that when parents are able to teach things
                that they love and are interested in, they bless our students with amazingly creative classes! We offer
                both academic and elective classes, at 50 minutes per class, along with a 1 hour lunch break. Students can
                take as many as four classes per session, but are not required to attend the full day.  Our Pre-K/Kindergarten
                group follows a slightly different schedule to meet their needs.
                At least one parent from each family is required to actively participate throughout the entire co-op day by
                volunteering each hour in one of our many volunteer positions. This is the only way we have found to make
                this type of co-op work efficiently and enjoyably for all involved.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-blue-100 bg-white p-2">
            <Image
              src="/images/about-classroom.jpg"
              alt="Classroom environment showing active homeschool teaching and learning"
              width={1200}
              height={900}
              className="h-[320px] w-full rounded-lg object-cover"
            />
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Learning groups are broken down as follows:
          </h2>
          <h3 className="text-lg md:text-xl italic text-gray-900 mb-6">
            (these are just suggestions – you can work with the leaders of these
            age groups to figure out a good fit for your child)
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {groupCards.map((card) => (
              <article
                key={card.label}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
              >
                <Image
                  src={card.image}
                  alt={card.imageAlt}
                  width={1200}
                  height={800}
                  className="h-52 w-full object-cover"
                />
                <div className="p-5">
                  <p className="font-bold text-lg text-blue-700">{card.label}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">Where we serve</h2>
            <p className="mt-3 text-gray-700 italic">
              We serve the Coachella Valley (Indio, La Quinta, Palm Desert, Palm Springs, Cathedral City, Rancho Mirage,
              Desert Hot Springs), as well as surrounding areas.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900">Find us</h2>
            <p className="mt-4 text-gray-700">Grace Chapel, Indio, CA</p>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3319.4271907655093!2d-116.25494572339673!3d33.69789333635636!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80daf83fbdd65fbb%3A0xcdfe7bb4a72bee6f!2sGrace%20Chapel%20Indio!5e0!3m2!1sen!2sus!4v1785802438531!5m2!1sen!2sus"
              width="100%"
              height="220"
              className="mt-4 border border-gray-200 rounded-lg"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>

        {publicFaqs.length > 0 && (
          <section className="mt-10 rounded-2xl border border-blue-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">Frequently Asked Questions</h2>
            <div className="mt-5 space-y-3">
              {publicFaqs.map((faq) => (
                <details key={faq.id} className="group rounded-lg border border-gray-200 p-4">
                  <summary className="cursor-pointer list-none pr-6 font-semibold text-gray-900 marker:hidden">{faq.question}</summary>
                  <p className="mt-3 whitespace-pre-wrap text-gray-700">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center pb-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
          >
            Back to Home
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center justify-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-8 rounded-lg transition-colors duration-200"
          >
            Sign In / Register
          </Link>
        </div>
      </div>
    </div>
  )
}
