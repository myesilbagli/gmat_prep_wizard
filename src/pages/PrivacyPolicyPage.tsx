import { LegalPageLayout, LegalP, LegalSection, LegalUl } from '../components/LegalPageLayout'

/**
 * Hosted on Firebase Hosting with the main web app. Update the effective date and
 * details when your practices change; have counsel review before relying on this text.
 */
export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="February 13, 2026">
      <LegalSection heading="Overview">
        <LegalP>
          GMAT Lexicon (“we”, “us”) provides vocabulary study tools on the web and mobile. This policy describes how we
          handle information when you use our services.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Account data.</strong> If you create an account, we collect identifiers you
          provide or that your sign-in provider shares with us (for example email address, subject to your provider’s
          settings). Authentication is processed by Google Firebase Authentication.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Your content.</strong> Words and phrases you save, study progress,
          preferences (such as gloss language, exam window, theme), and related metadata you store in the app are saved
          in your private database records associated with your account.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Usage and technical data.</strong> Our infrastructure providers may process
          technical data such as IP address, device type, and timestamps as part of delivering and securing the service.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>Subscriptions and purchases (mobile).</strong> If you buy <strong>Lexicon Pro</strong>{' '}
          or another paid plan in our iOS app, <strong>Apple</strong> processes payment. We do not receive your full payment
          card number. Apple shares subscription status and transaction-related identifiers with us (or our processors) so we
          can unlock features in the app.
        </LegalP>
        <LegalP>
          <strong style={{ color: '#dae2fd' }}>RevenueCat.</strong> We use <strong>RevenueCat, Inc.</strong> to manage in-app
          purchases and subscription state across devices. RevenueCat may receive identifiers such as your app user ID (we may
          use your account ID from our sign-in system), product and transaction identifiers, and device or app metadata needed
          to verify entitlements. See RevenueCat’s privacy policy for details on how they process data.
        </LegalP>
      </LegalSection>

      <LegalSection heading="How we use information">
        <LegalUl
          items={[
            'To provide sign-in, sync your vocabulary, and run study features you request.',
            'To grant or revoke access to Lexicon Pro and other subscription features based on a valid subscription.',
            'To generate definitions, examples, and related study content when you use analysis or generation features (your prompts may be sent to our backend and an AI provider to produce a response).',
            'To maintain security, debug issues, and comply with law where required.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Third-party services">
        <LegalP>We rely on service providers that process data on our behalf, including:</LegalP>
        <LegalUl
          items={[
            'Google Firebase (authentication, database, and hosting for our website).',
            'Google or Apple, if you choose those sign-in options.',
            'Apple, for in-app subscription purchases and renewal on iOS.',
            'RevenueCat, for subscription and purchase management in our mobile apps.',
            'Cloud infrastructure and AI APIs used to power vocabulary analysis and generation.',
          ]}
        />
        <LegalP>These providers are contractually or policy-bound to use data as described in their own privacy notices.</LegalP>
      </LegalSection>

      <LegalSection heading="Retention and deletion">
        <LegalP>
          We keep your account and saved content until you delete it or delete your account. You can remove individual
          entries in the app where supported. To request deletion of your account and associated data, contact us using
          the developer support channel listed on the App Store or Play Store, or the contact method we publish on our
          website.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Security">
        <LegalP>
          We use industry-standard measures appropriate to the service (including encrypted transport and access controls
          on our backend). No method of transmission or storage is completely secure.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Children">
        <LegalP>The service is not directed at children under 13 (or the minimum age required in your region).</LegalP>
      </LegalSection>

      <LegalSection heading="Changes">
        <LegalP>
          We may update this policy from time to time. We will post the new version on this page and update the “Last
          updated” date.
        </LegalP>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalP>
          For privacy questions, use the support or contact information provided on our App Store / Play Store listing or
          on our website.
        </LegalP>
      </LegalSection>
    </LegalPageLayout>
  )
}
