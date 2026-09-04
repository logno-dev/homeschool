import { getAuthenticatedUser } from '@/lib/server-auth'
import ScholarshipApplicationForm from '@/app/components/ScholarshipApplicationForm'
import ScholarshipDonationCard from '@/app/components/ScholarshipDonationCard'
import { getFaqsByVisibility, getGlobalSetting } from '@/lib/database'

type ExternalLink = {
  id: number
  label: string,
  href: string,
  desc?: string
}

export default async function ResourcesPage() {
  await getAuthenticatedUser()
  const [privateFaqs, publicFaqs] = await Promise.all([
    getFaqsByVisibility('private'),
    getFaqsByVisibility('public')
  ])
  const [supervisionFormUrl, supervisionFormFilename] = await Promise.all([
    getGlobalSetting('supervision_form_url'),
    getGlobalSetting('supervision_form_filename')
  ])

  const externalLinks: Array<ExternalLink> = [
    {
      id: 3,
      label: "Desert Area Homeschoolers Facebook Group",
      href: "https://www.facebook.com/groups/139350846089369/",
      desc: "An all - inclusive group of homeschool families located in The Coachella Valley & surrounding areas. Please join us for support, friendship & collaboration."
    },
    {
      id: 1,
      label: "California Homeschool Network",
      href: "https://californiahomeschool.net/",
      desc: "California Homeschool Network serves to inform and empower homeschooling families, educate the public, and foster community among home educators in the state of California."
    },
    {
      id: 2,
      label: "California Homeschool Network, How to Homeschool",
      href: "https://www.californiahomeschool.net/wp-content/uploads/2018/01/JTF-2018.pdf",
      desc: "Just the facts"
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Resources</h1>
            <p className="text-gray-600">Find internal tools and trusted resources for families.</p>
          </div>

          {privateFaqs.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Family FAQs</h2>
              <div className="space-y-3">
                {privateFaqs.map((faq) => (
                  <details key={faq.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <summary className="cursor-pointer list-none font-semibold text-gray-900">{faq.question}</summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Co-op Forms</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm grid gap-2">
              <p>Due to California licensing regulations and liability issues, we require that a parent or guardian be on campus AT ALL TIMES for every student and child that is in attendance. Some exceptions can be made, on occasion. Please speak with a Board Member about these exceptions. Board Member approval will be required.</p>
              <p>If a student is brought to co-op by a family member, other than their parent, a <strong>Request for Adult Relative/Family Friend to Supervise and Provide Care for Student</strong> will need to be filled out ahead of time by the parent and signed, giving permission for that person to bring the student to co-op. That designated relative will need to remain on site with the student the entire time and may need to full fill some of the parents volunteer responsibilities unless other arrangements were made with a fellow DVCLC participant.</p>
              {supervisionFormUrl && <p>Download and complete the <a href={supervisionFormUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline">Request for Adult Relative/Family Friend to Supervise and Provide Care for Student form</a> and turn it in in person.</p>}
            </div>
             <div className="grid gap-6 md:grid-cols-2">
               <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Scholarship Application</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Request fee assistance through the scholarship fund for your current session fees.
                </p>
                 <ScholarshipApplicationForm />
               </div>
               <div className="space-y-6">
                 <ScholarshipDonationCard />
                 <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
                   <h3 className="text-lg font-semibold text-gray-900">Find Us</h3>
                   <p className="mt-2 text-sm text-gray-600">Grace Chapel, Indio, CA</p>
                   <iframe
                     src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3319.4271907655093!2d-116.25494572339673!3d33.69789333635636!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80daf83fbdd65fbb%3A0xcdfe7bb4a72bee6f!2sGrace%20Chapel%20Indio!5e0!3m2!1sen!2sus!4v1785802438531!5m2!1sen!2sus"
                     title="Map to Grace Chapel, Indio"
                     className="mt-4 h-56 w-full rounded-lg border border-gray-200"
                     loading="lazy"
                     referrerPolicy="strict-origin-when-cross-origin"
                   />
                 </div>
               </div>
             </div>
          </section>


          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Helpful Homeschool Links</h2>
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <ul className="space-y-3 text-sm text-gray-700">
                {externalLinks.map((link) => (
                  <li key={link.id}>
                    <a className="text-blue-600 hover:text-blue-700 text-lg" href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                    <span className="block text-sm text-gray-500">{link.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
           </section>

           {publicFaqs.length > 0 && (
             <section className="space-y-4">
               <h2 className="text-xl font-semibold text-gray-900">Frequently Asked Questions</h2>
               <div className="space-y-3">
                 {publicFaqs.map((faq) => (
                   <details key={faq.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                     <summary className="cursor-pointer list-none font-semibold text-gray-900">{faq.question}</summary>
                     <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{faq.answer}</p>
                   </details>
                 ))}
               </div>
             </section>
           )}
         </div>
      </main>
    </div>
  )
}
