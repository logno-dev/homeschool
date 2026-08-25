'use client'

type ReleaseChoice = 'agree' | 'do_not_agree' | ''

interface AcknowledgementFieldsProps {
  releaseLiabilityAgreed: boolean
  contactInfoRelease: ReleaseChoice
  photographyRelease: ReleaseChoice
  handbookAgreed: boolean
  handbookUrl: string
  handbookVersion: string
  onReleaseLiabilityChange: (value: boolean) => void
  onContactInfoReleaseChange: (value: ReleaseChoice) => void
  onPhotographyReleaseChange: (value: ReleaseChoice) => void
  onHandbookChange: (value: boolean) => void
}

export default function AcknowledgementFields({
  releaseLiabilityAgreed,
  contactInfoRelease,
  photographyRelease,
  handbookAgreed,
  handbookUrl,
  handbookVersion,
  onReleaseLiabilityChange,
  onContactInfoReleaseChange,
  onPhotographyReleaseChange,
  onHandbookChange
}: AcknowledgementFieldsProps) {
  return (
    <div className="space-y-6 border-t border-gray-200 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Required acknowledgements</h2>
        <p className="mt-1 text-sm text-gray-600">Please review and record your choices before creating an account.</p>
      </div>

      <section>
        <h3 className="font-semibold text-gray-900">1. Release of Liability</h3>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-700">
          <p>As a Homeschool Co-Op, we believe it is best to be sure that all members understand our position prior to any mishaps. Desert Valley Creative Learning Collaborative is organized exclusively for educational purposes under section 501(c)(3) of the Internal Revenue Code. The mission of Desert Valley Creative Learning Collaborative is to provide homeschooling students of all ages a creative and supportive learning environment, which inspires them to be life-long learners, and to encourage and nurture their families in the process. The Board of Directors and leadership team are made up of those who have volunteered their time to organize activities and/or classes for the Co-op.</p>
          <p className="mt-3">Desert Valley Creative Learning Collaborative&apos;s leaders, members, and our meeting spaces, cannot be held liable for any injuries or damages, whether connected with a Desert Valley Creative Learning Collaborative event or not. Parents are responsible for their own children. Children MUST be under the full care, conduct, responsibility and supervision of their parent(s) or a parent-appointed adult. If you send your child to Co-Op with another adult, it should be one who feels comfortable correcting your child, if necessary.</p>
          <p className="mt-3">Any special guests who accompany members to Co-op or any event are under the sole responsibility of that member for behavior, damages, injuries, etc. It is expected that any member or his child(ren) or guest(s) who damage property or who cause injury, willfully or not, will take personal responsibility for his/their actions. Desert Valley Creative Learning will not be held liable in any way in such situations.</p>
          <p className="mt-3">Any person, member or not, who has a claim will be directed to discuss the offense directly with the party he/she believes to be responsible. The outcome of such a problem is not Desert Valley Creative Learning Collaborative&apos;s responsibility.</p>
          <p className="mt-3">I voluntarily agree to accept any and all risks of injury, death or damages of any nature to my family or anyone that I may bring to a Desert Valley Creative Learning Collaborative function. I also agree to protect and hold harmless Desert Valley Creative Learning Collaborative, its Board of Directors, and volunteers from any and all claims, loss, damages, injuries or expense arising out of, or from any other occurrence related to a Desert Valley Creative Learning Collaborative meeting, classes and/or events.</p>
          <p className="mt-3">I assume full responsibility for my child(ren&apos;s) behavior and for assuring their supervision at all times. I also assume full responsibility for any damage or injury caused by my child(ren)&apos;s actions or actions of a guest I bring to a Desert Valley Creative Learning Collaborative function.</p>
        </div>
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={releaseLiabilityAgreed} onChange={(event) => onReleaseLiabilityChange(event.target.checked)} required className="mt-1" />
          <span>I agree to the Release of Liability.</span>
        </label>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900">2. Contact Information Release</h3>
        <p className="mt-2 text-sm text-gray-700">I acknowledge and certify that I am the legal guardian or parent of the minors listed above. I give permission for my family&apos;s contact information to be published and distributed to the other group members of DVCLC.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-800">
          <label className="flex items-center gap-2"><input type="radio" name="contactInfoRelease" checked={contactInfoRelease === 'agree'} onChange={() => onContactInfoReleaseChange('agree')} required /> I agree</label>
          <label className="flex items-center gap-2"><input type="radio" name="contactInfoRelease" checked={contactInfoRelease === 'do_not_agree'} onChange={() => onContactInfoReleaseChange('do_not_agree')} /> I do not agree</label>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900">3. Photography Release</h3>
        <p className="mt-2 text-sm text-gray-700">DVCLC representatives sometimes take photographs for the co-op&apos;s use in print and electronic publications. This serves as a public notice of DVCLC&apos;s intent to do so and as a release of permission to use such images as it deems fit.</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-800">
          <label className="flex items-center gap-2"><input type="radio" name="photographyRelease" checked={photographyRelease === 'agree'} onChange={() => onPhotographyReleaseChange('agree')} required /> I agree</label>
          <label className="flex items-center gap-2"><input type="radio" name="photographyRelease" checked={photographyRelease === 'do_not_agree'} onChange={() => onPhotographyReleaseChange('do_not_agree')} /> I do not agree</label>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900">4. DVCLC Handbook</h3>
        {handbookUrl ? (
          <p className="mt-2 text-sm text-gray-700"><a href={handbookUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600 hover:text-blue-800">Download the current handbook (PDF)</a>{handbookVersion && ` (Version ${handbookVersion})`}</p>
        ) : (
          <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">The current handbook is not configured yet. Please contact an administrator.</p>
        )}
        <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={handbookAgreed} onChange={(event) => onHandbookChange(event.target.checked)} required className="mt-1" />
          <span>I have reviewed the current DVCLC handbook and agree to acknowledge it. {handbookVersion && `(Version ${handbookVersion})`}</span>
        </label>
      </section>
    </div>
  )
}
