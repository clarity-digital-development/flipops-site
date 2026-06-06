export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Terms of Service
        </h1>

        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            <strong>Effective Date:</strong> November 30, 2025
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 mb-8">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This is a placeholder page. Please generate comprehensive Terms of Service using{" "}
              <a href="https://termly.io" target="_blank" rel="noopener noreferrer" className="underline">
                Termly.io
              </a>{" "}
              and paste the generated content here.
            </p>
          </div>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              By accessing and using FlipOps ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              2. Description of Service
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              FlipOps is a real estate investment management platform that provides tools for property analysis, deal management, and investment tracking.
              The Service is provided as a Software-as-a-Service (SaaS) platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              3. Disclaimers
            </h2>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                <strong className="text-yellow-800 dark:text-yellow-200">Important Investment Disclaimer:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>FlipOps does not provide investment, legal, tax, or financial advice.</li>
                <li>All calculations and estimates provided by the Service are for informational purposes only.</li>
                <li>FlipOps does not guarantee the accuracy of property data, valuations, or financial projections.</li>
                <li>Users are responsible for conducting their own due diligence and consulting with qualified professionals.</li>
                <li>Real estate investing carries risk. Past performance does not guarantee future results.</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              4. User Responsibilities
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              Users of the Service agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
              <li>Comply with all applicable laws and regulations, including TCPA, CAN-SPAM, and GDPR</li>
              <li>Maintain the security and confidentiality of their account credentials</li>
              <li>Not use the Service for any unlawful or prohibited purpose</li>
              <li>Not attempt to gain unauthorized access to the Service or its related systems</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              5. Data Accuracy
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              While we strive to provide accurate information, FlipOps does not warrant or guarantee the accuracy, completeness,
              or timeliness of property data obtained from third-party sources including BatchData, or other data providers.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              6. Limitation of Liability
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              FlipOps shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from
              your use or inability to use the Service, including but not limited to investment losses, data inaccuracies, or service interruptions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              7. Modifications to Service
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              FlipOps reserves the right to modify or discontinue the Service at any time, with or without notice.
              We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              8. Contact Information
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              For questions about these Terms of Service, please contact us at:{" "}
              <a href="mailto:support@flipops.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                support@flipops.com
              </a>
            </p>
          </section>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Note to Developer:</strong> Replace this entire content with the comprehensive Terms of Service
              generated from Termly.io. Make sure to include sections on:
            </p>
            <ul className="list-disc pl-6 mt-3 text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>Subscription and billing terms</li>
              <li>Account termination and cancellation policy</li>
              <li>Intellectual property rights</li>
              <li>User-generated content</li>
              <li>Dispute resolution and arbitration</li>
              <li>Governing law and jurisdiction</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
