export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Privacy Policy
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            <strong>Effective Date:</strong> November 30, 2025
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-8">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This is a placeholder page. Please generate a comprehensive Privacy Policy using{" "}
              <a href="https://termly.io" target="_blank" rel="noopener noreferrer" className="underline">
                Termly.io
              </a>{" "}
              and paste the generated content here.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Information We Collect
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              FlipOps collects and processes the following types of information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Account Information:</strong> Name, email address, phone number</li>
              <li><strong>Property Data:</strong> Addresses, owner information, property details</li>
              <li><strong>Contact Information:</strong> Phone numbers and email addresses obtained through skip tracing</li>
              <li><strong>Financial Data:</strong> Deal calculations, budgets, ROI projections (stored locally in your account)</li>
              <li><strong>Usage Data:</strong> How you interact with our Service, including pages visited and features used</li>
              <li><strong>Device Information:</strong> IP address, browser type, operating system</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              We use the collected information to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li>Provide and maintain the FlipOps Service</li>
              <li>Process property data and perform skip tracing through third-party providers</li>
              <li>Calculate investment metrics and generate reports</li>
              <li>Communicate with you about your account and Service updates</li>
              <li>Improve our Service and develop new features</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Third-Party Services
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              FlipOps integrates with the following third-party services:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Clerk:</strong> Authentication and user management</li>
                            <li><strong>BatchData:</strong> Skip tracing and contact information lookup</li>
              <li><strong>Railway:</strong> Application hosting and infrastructure</li>
              <li><strong>Vercel (optional):</strong> Application deployment</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              Each third-party service has its own privacy policy governing how they handle data.
              We encourage you to review their policies.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. Data Storage and Security
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              Your data is stored securely in a PostgreSQL database hosted on Railway's infrastructure.
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-gray-700 dark:text-gray-300">
              <li>Encrypted connections (HTTPS/TLS)</li>
              <li>Secure authentication via Clerk</li>
              <li>Multi-tenant data isolation (your data is never visible to other users)</li>
              <li>Regular security audits and updates</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Data Retention
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              We retain your data for as long as your account is active or as needed to provide you the Service.
              If you delete your account, we will delete your personal data within 30 days, except where we are
              required by law to retain certain information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Your Rights
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              You have the following rights regarding your data:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your data</li>
              <li><strong>Export:</strong> Download your data in a portable format (CSV)</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 mt-3">
              To exercise these rights, please contact us at{" "}
              <a href="mailto:privacy@flipops.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                privacy@flipops.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Cookies and Tracking
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              FlipOps uses cookies and similar tracking technologies to maintain your session, remember your preferences,
              and analyze Service usage. You can control cookies through your browser settings, but disabling cookies
              may affect Service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Children's Privacy
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              FlipOps is not intended for use by individuals under the age of 18. We do not knowingly collect personal
              information from children. If we become aware that we have collected data from a child, we will delete it promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              9. Changes to This Policy
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the "Effective Date" above. Continued use of the Service after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              10. Contact Us
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-3 text-gray-700 dark:text-gray-300">
              <p>Email: <a href="mailto:privacy@flipops.com" className="text-blue-600 dark:text-blue-400 hover:underline">privacy@flipops.com</a></p>
              <p className="mt-1">Or through our website: <a href="https://flipops.com" className="text-blue-600 dark:text-blue-400 hover:underline">https://flipops.com</a></p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Note to Developer:</strong> Replace this entire content with the comprehensive Privacy Policy
              generated from Termly.io. Make sure to include sections on:
            </p>
            <ul className="list-disc pl-6 mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>GDPR compliance (if serving EU users)</li>
              <li>CCPA compliance (California users)</li>
              <li>International data transfers</li>
              <li>Do Not Track signals</li>
              <li>Data breach notification procedures</li>
              <li>Contact information for Data Protection Officer (if applicable)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
