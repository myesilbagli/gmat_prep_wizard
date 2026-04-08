import { LegalPageLayout, LegalP, LegalSection, LegalUl } from '../components/LegalPageLayout'
import { LP } from '../lib/landingPalette'

/**
 * Hosted on Firebase Hosting with the main web app. Have counsel review before relying on this text.
 */
export function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="February 13, 2026">
      <LegalSection heading="Agreement">
        <LegalP>
          By using GMAT Lexicon’s websites, mobile apps, and related services (the “Service”), you agree to these Terms.
          If you do not agree, do not use the Service.
        </LegalP>
      </LegalSection>

      <LegalSection heading="The Service">
        <LegalP>
          The Service helps you learn and organize GMAT-related vocabulary. Features may include saving words, quizzes,
          sessions, and AI-assisted explanations or examples. We may change, suspend, or discontinue features with
          reasonable notice where practicable.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Accounts">
        <LegalP>
          You are responsible for activity under your account and for keeping credentials secure. You must provide
          accurate information where required and notify us of unauthorized use through the contact options we provide.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Lexicon Pro (subscriptions)">
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Plans.</strong> We may offer <strong>Lexicon Pro</strong> as an auto-renewing
          subscription (for example monthly or yearly) in our iOS app. The subscription unlocks premium features described
          in the app at checkout (such as Quick Capture word generation, guided study sessions, and other tools marked as
          Pro). We may add, change, or relocate features over time with reasonable notice where practicable.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Billing and renewal.</strong> Payment is charged to your Apple ID account.
          Subscriptions renew automatically until you cancel. The renewal price is shown in the app and may change if Apple
          or we update pricing; where required, Apple will seek your consent before charging a new price.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Cancellation and refunds.</strong> You can cancel in{' '}
          <strong>Settings → Subscriptions</strong> on your Apple device, or through your Apple ID account settings. If you
          use an introductory or free trial offer, cancel at least 24 hours before it ends to avoid being charged if you
          do not wish to continue. Refunds and billing disputes for purchases through Apple are handled under{' '}
          <strong>Apple’s terms and policies</strong>, not as a direct refund from us.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Restore purchases.</strong> Use <strong>Restore purchases</strong> in the app
          if you reinstall or change devices; you must be signed in with the same Apple ID used for the purchase.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Your content">
        <LegalP>
          You retain rights to content you submit. You grant us a license to host, process, and display that content only
          as needed to operate the Service for you (including sending text to our backend for generation or analysis when
          you use those features).
        </LegalP>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <LegalP>You agree not to:</LegalP>
        <LegalUl
          items={[
            'Violate law or others’ rights.',
            'Attempt to probe, disrupt, or gain unauthorized access to our systems or other users’ data.',
            'Use the Service to generate or distribute harmful, unlawful, or infringing material.',
            'Reverse engineer or scrape the Service except as allowed by applicable law.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="AI-generated output">
        <LegalP>
          Some outputs are produced automatically and may be inaccurate or incomplete. They are study aids only, not
          professional, legal, or test-official advice. You are responsible for how you use generated content.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Disclaimer">
        <LegalP>
          THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <LegalP>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
          OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR DATA, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY
          FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE GREATER OF (A) AMOUNTS YOU PAID US FOR THE SERVICE IN
          THE TWELVE MONTHS BEFORE THE CLAIM OR (B) FIFTY US DOLLARS, IF YOU HAVE NOT PAID US.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Termination">
        <LegalP>
          You may stop using the Service at any time. We may suspend or terminate access for breach of these Terms or where
          needed to protect the Service or other users.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Governing law">
        <LegalP>
          These Terms are governed by the laws applicable in your primary place of residence or, if you are a business,
          the jurisdiction we designate in a separate agreement; if none is stated, the laws of the United States and the
          State of Delaware apply, excluding conflict-of-law rules.
        </LegalP>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9, color: LP.muted }}>
          (Replace the governing law clause with the jurisdiction your counsel recommends.)
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <LegalP>
          We may update these Terms. Continued use after changes become effective constitutes acceptance of the revised
          Terms. Material changes will be indicated by updating the date above.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalP>
          For questions about these Terms, use the support or contact information on our App Store / Play Store listing or
          website.
        </LegalP>
      </LegalSection>
    </LegalPageLayout>
  )
}
