import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms and Conditions - ChurchOnline',
  description:
    'The terms that govern use of ChurchOnline accounts, church workspaces, and related services.',
}

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms and Conditions"
      description="These Terms and Conditions govern your access to and use of ChurchOnline, including accounts created for individuals and churches."
      sections={[
        {
          title: '1. Acceptance of these terms',
          paragraphs: [
            'By creating an account, creating a church workspace, or using ChurchOnline, you agree to these Terms and Conditions and our Privacy Policy. If you create a church workspace, you confirm that you are authorised to accept these terms on behalf of that church.',
            'If you do not agree, you must not create an account or use the service.',
          ],
        },
        {
          title: '2. About ChurchOnline',
          paragraphs: [
            'ChurchOnline is a church management platform that helps churches manage members, services, events, departments, giving, communication, volunteers, resources, and related ministry activities. Some features may be provided by third-party service providers, including hosting, email, SMS, payments, and maps.',
          ],
        },
        {
          title: '3. Accounts and security',
          bullets: [
            'You must provide accurate information when creating an account and keep it up to date.',
            'You are responsible for protecting your login credentials and for activity carried out through your account.',
            'You must notify us promptly if you believe your account has been accessed without authorisation.',
            'You must be legally able to enter into a binding agreement to create an account. Church member records may include information about minors, but the account holder and church administrator are responsible for managing that information lawfully.',
          ],
        },
        {
          title: '4. Church administrators and members',
          paragraphs: [
            'A person who creates a church workspace becomes its initial administrator. Church administrators control the workspace, invite or manage members, assign roles, and decide what information is collected and shared within the church.',
            'Each church is responsible for obtaining any notices or consents required from its members and for ensuring that its use of ChurchOnline complies with applicable law. We provide tools to support privacy and access control, but we do not control a church\u2019s internal policies or the accuracy of the information it enters.',
          ],
        },
        {
          title: '5. Acceptable use',
          bullets: [
            'Do not use ChurchOnline to break any law, infringe another person\u2019s rights, or facilitate fraud or abuse.',
            'Do not upload malicious code, attempt to gain unauthorised access, or interfere with the security or operation of the service.',
            'Do not use the service to send spam, unlawful messages, or communications that the recipient has not consented to receive.',
            'Do not use another person\u2019s account or church workspace without permission.',
            'Do not scrape, copy, or misuse data belonging to a church or its members.',
          ],
        },
        {
          title: '6. Plans, payments, and third-party charges',
          paragraphs: [
            'Some features or plan tiers may be offered free of charge, while others may require payment. Any applicable prices, limits, and billing arrangements will be shown in the product or agreed with you separately. You are responsible for charges incurred through payment or communication providers connected to your church workspace, including mobile-money, SMS, and email charges.',
          ],
        },
        {
          title: '7. Church and member data',
          paragraphs: [
            'As between you and ChurchOnline, your church owns the data it enters into its workspace. You grant us the limited rights needed to host, process, back up, and display that data so that we can provide and support the service.',
            'You are responsible for ensuring that you have the right to submit personal information about members, visitors, volunteers, donors, and other people. Our Privacy Policy explains how we handle personal data and the choices available to you.',
          ],
        },
        {
          title: '8. Intellectual property',
          paragraphs: [
            'ChurchOnline, its branding, software, designs, and documentation are owned by or licensed to us and are protected by intellectual-property laws. These terms do not grant you ownership of the platform. You may use the service only as permitted by these terms and your plan.',
          ],
        },
        {
          title: '9. Availability and changes',
          paragraphs: [
            'We aim to keep ChurchOnline available and reliable, but we do not guarantee uninterrupted or error-free operation. We may maintain, update, suspend, or change features where reasonably necessary, and we will try to give notice of material changes where practical.',
          ],
        },
        {
          title: '10. Suspension and termination',
          paragraphs: [
            'We may suspend or terminate access where necessary to protect the service, comply with law, investigate misuse, or address a material breach of these terms. You may stop using the service at any time. Church deletion and account deletion tools are available in the product, subject to the safeguards and retention periods described in our Privacy Policy.',
          ],
        },
        {
          title: '11. Disclaimers',
          paragraphs: [
            'ChurchOnline is provided on an as-available basis. To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement. ChurchOnline is a management tool and does not provide legal, financial, tax, pastoral, or professional advice.',
          ],
        },
        {
          title: '12. Limitation of liability',
          paragraphs: [
            'To the extent permitted by law, ChurchOnline will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, goodwill, or church operations arising from your use of the service. Nothing in these terms excludes liability that cannot lawfully be excluded.',
          ],
        },
        {
          title: '13. Governing law',
          paragraphs: [
            'These terms are governed by the laws of Kenya. Any dispute arising from these terms or the service will be subject to the jurisdiction of the courts of Kenya, unless applicable law requires otherwise.',
          ],
        },
        {
          title: '14. Changes to these terms',
          paragraphs: [
            'We may update these terms to reflect changes in the service, legal requirements, or our practices. When we make a material change, we will update the effective date and may ask you to accept the revised terms before continuing to use the service.',
          ],
        },
        {
          title: '15. Contact us',
          paragraphs: [
            `Questions about these terms can be sent to ${LEGAL_CONTACT_EMAIL} or through our contact page.`,
          ],
        },
      ]}
    />
  )
}
