export const metadata = { title: "End User License Agreement — RJK Sandbox" };

const EFFECTIVE_DATE = "April 5, 2026";

export default function EULAPage() {
  return (
    <article className="prose prose-invert prose-slate max-w-none">
      <h1 className="text-2xl font-bold text-white mb-1">End User License Agreement</h1>
      <p className="text-sm text-slate-500 mb-10">Effective date: {EFFECTIVE_DATE}</p>

      <Section title="1. Acceptance of Terms">
        <p>
          By accessing or using RJK Sandbox (the "Service"), you agree to be bound by this End
          User License Agreement ("Agreement"). If you do not agree to these terms, do not use the
          Service. Access to the Service is limited to authorized individuals expressly permitted by
          the operator.
        </p>
      </Section>

      <Section title="2. License Grant">
        <p>
          Subject to the terms of this Agreement, the operator grants you a limited, non-exclusive,
          non-transferable, revocable license to access and use the Service solely for your
          authorized internal purposes. This license does not include the right to sublicense,
          resell, or otherwise make the Service available to any third party.
        </p>
      </Section>

      <Section title="3. Restrictions">
        <p>You agree not to:</p>
        <ul>
          <li>Share your access credentials with any other person;</li>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law;</li>
          <li>Attempt to reverse engineer, decompile, or otherwise derive source code from the Service;</li>
          <li>Use the Service to store or transmit malicious code or interfere with its operation;</li>
          <li>Access any accounts, data, or systems within the Service that you are not explicitly authorized to access.</li>
        </ul>
      </Section>

      <Section title="4. Third-Party Services">
        <p>
          The Service integrates with third-party platforms including Google (for authentication)
          and QuickBooks Online (for financial data). Your use of those platforms is governed by
          their respective terms of service and privacy policies. The operator is not responsible
          for the availability, accuracy, or conduct of any third-party service.
        </p>
      </Section>

      <Section title="5. Intellectual Property">
        <p>
          All content, software, and materials comprising the Service are the property of the
          operator or its licensors and are protected by applicable intellectual property laws.
          Nothing in this Agreement transfers any ownership rights to you.
        </p>
      </Section>

      <Section title="6. Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS
          OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, OR NON-INFRINGEMENT. THE OPERATOR DOES NOT WARRANT THAT THE SERVICE
          WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY DEFECTS WILL BE CORRECTED. THIS IS A
          PERSONAL SANDBOX APPLICATION AND SHOULD NOT BE RELIED UPON FOR CRITICAL BUSINESS
          DECISIONS.
        </p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, THE OPERATOR SHALL NOT BE LIABLE FOR ANY
          INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR
          RELATED TO YOUR USE OF THE SERVICE, EVEN IF THE OPERATOR HAS BEEN ADVISED OF THE
          POSSIBILITY OF SUCH DAMAGES. THE OPERATOR'S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING
          FROM THIS AGREEMENT SHALL NOT EXCEED ONE HUNDRED DOLLARS ($100).
        </p>
      </Section>

      <Section title="8. Termination">
        <p>
          The operator may terminate or suspend your access to the Service at any time, with or
          without notice, for any reason, including if you breach any term of this Agreement. Upon
          termination, your right to use the Service immediately ceases.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          The operator reserves the right to modify this Agreement at any time. Continued use of
          the Service after any such change constitutes your acceptance of the new terms. It is
          your responsibility to review this Agreement periodically.
        </p>
      </Section>

      <Section title="10. Governing Law">
        <p>
          This Agreement shall be governed by and construed in accordance with the laws of the
          United States, without regard to its conflict of law provisions.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about this Agreement may be directed to the site operator via the contact
          information provided within the Service.
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
