export const metadata = { title: "Privacy Policy — RJK Sandbox" };

const EFFECTIVE_DATE = "April 5, 2026";

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert prose-slate max-w-none">
      <h1 className="text-2xl font-bold text-white mb-1">Privacy Policy</h1>
      <p className="text-sm text-slate-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

      <Section title="1. Overview">
        <p>
          This Privacy Policy describes how RJK Sandbox (the "Service") collects, uses, and
          handles information when you use the Service. RJK Sandbox is a personal, access-restricted
          application and is not available to the general public.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p>We collect the following information:</p>
        <ul>
          <li>
            <strong className="text-slate-200">Google account information</strong> — When you sign
            in with Google, we receive your name, email address, and profile picture from Google.
            This information is used solely to authenticate you and identify your account within
            the Service.
          </li>
          <li>
            <strong className="text-slate-200">QuickBooks financial data</strong> — If you connect
            a QuickBooks Online account, the Service reads financial report data (such as Profit
            &amp; Loss and Accounts Receivable) from your QuickBooks company. This data is
            fetched on demand and is not persistently stored on our servers beyond your active
            session.
          </li>
          <li>
            <strong className="text-slate-200">Usage data</strong> — Standard server logs may
            capture IP addresses, browser type, pages visited, and timestamps. This data is used
            for debugging and operational purposes only.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>Information collected is used exclusively to:</p>
        <ul>
          <li>Authenticate and authorize your access to the Service;</li>
          <li>Display financial reports and dashboard data that you have requested;</li>
          <li>Maintain the security and integrity of the Service;</li>
          <li>Diagnose technical issues and improve Service performance.</li>
        </ul>
        <p>
          We do not use your information for advertising, marketing, or any commercial purpose.
        </p>
      </Section>

      <Section title="4. Information Sharing">
        <p>
          We do not sell, rent, or share your personal information with third parties except in
          the following limited circumstances:
        </p>
        <ul>
          <li>
            <strong className="text-slate-200">Service providers</strong> — We use Supabase for
            database hosting and Google for authentication. These providers process data on our
            behalf and are bound by their own privacy commitments.
          </li>
          <li>
            <strong className="text-slate-200">Legal requirements</strong> — We may disclose
            information if required to do so by law or in response to a valid legal process.
          </li>
        </ul>
      </Section>

      <Section title="5. Data Storage and Security">
        <p>
          Account information (name and email) is stored in a Supabase-hosted database. QuickBooks
          financial data is not stored persistently — it is fetched from QuickBooks Online when
          you view a report and held only in your active session.
        </p>
        <p>
          We implement reasonable technical measures to protect your information, including
          HTTPS encryption, HTTP-only session cookies, and access controls. However, no method
          of transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="6. Cookies and Session Data">
        <p>
          The Service uses HTTP-only cookies to maintain your authenticated session and, where
          applicable, to store short-lived OAuth tokens for third-party integrations. These
          cookies are not accessible to client-side scripts and expire automatically. We do not
          use tracking cookies or third-party analytics cookies.
        </p>
      </Section>

      <Section title="7. Data Retention">
        <p>
          Account records are retained for as long as your access to the Service is active. If
          your access is revoked, your account data may be deleted upon request. Server logs are
          retained for a limited period for operational purposes.
        </p>
      </Section>

      <Section title="8. Your Rights">
        <p>
          You may request access to, correction of, or deletion of any personal information we
          hold about you by contacting the site operator. Requests will be honored within a
          reasonable timeframe.
        </p>
      </Section>

      <Section title="9. Third-Party Links and Services">
        <p>
          The Service integrates with third-party platforms (Google, QuickBooks Online, Supabase).
          This Privacy Policy does not cover how those platforms handle your data. We encourage
          you to review their respective privacy policies.
        </p>
      </Section>

      <Section title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Changes will be reflected by an
          updated effective date at the top of this page. Continued use of the Service after
          changes are posted constitutes your acceptance of the revised policy.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          If you have questions or concerns about this Privacy Policy, please contact the site
          operator via the contact information provided within the Service.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-white mb-2">{title}</h2>
      <div className="text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
