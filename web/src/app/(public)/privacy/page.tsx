import type { Metadata } from 'next'
import { LegalDocument } from '@/components/legal/LegalDocument'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy - ChurchOnline',
  description:
    'How ChurchOnline collects, uses, protects, and shares personal information for accounts and church workspaces.',
}

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="This Privacy Policy explains how ChurchOnline handles personal information when you use our website, create an account or church workspace, or interact with a church that uses ChurchOnline."
      sections={[
        {
          title: '1. Who we are',
          paragraphs: [
            'ChurchOnline provides church management software for churches and their members. In this policy, "we", "us", and "ChurchOnline" refer to the operators of the ChurchOnline service.',
            'A church that uses ChurchOnline is generally responsible for the member, visitor, giving, and communication data that it enters into its workspace. We process that data on the church\u2019s behalf and according to the church\u2019s instructions, while also processing account and service data for our own operational purposes.',
          ],
        },
        {
          title: '2. Information we collect',
          bullets: [
            'Account information, such as your name, email address, phone number, profile details, password credentials, and church memberships.',
            'Church workspace information, such as church profile details, leadership and member records, departments, events, attendance, giving and pledge records, prayer requests, sermons, resources, and volunteer information.',
            'Communication information, such as messages sent through the platform, SMS and email delivery details, and contact-form submissions.',
            'Usage and technical information, such as login events, device or browser information, approximate location derived from network data, error logs, and security events.',
            'Payment and transaction information needed to process giving or plan payments. We do not store full payment-card details; payment providers process those details under their own terms.',
          ],
        },
        {
          title: '3. How we use information',
          bullets: [
            'To create and secure accounts, authenticate users, and provide access to the correct church workspace.',
            'To operate church features, including member management, events, attendance, giving, communication, prayer, sermons, and reporting.',
            'To send service messages, verification emails, security alerts, and support responses.',
            'To maintain, troubleshoot, monitor, and improve the service.',
            'To detect and prevent fraud, abuse, and unauthorised access.',
            'To comply with legal obligations and enforce our Terms and Conditions.',
          ],
        },
        {
          title: '4. Legal bases for processing',
          paragraphs: [
            'Where applicable, we process personal data on the basis of your consent, the performance of a contract with you, compliance with legal obligations, and our legitimate interests in operating and protecting the service. A church is responsible for identifying the lawful basis for the member and visitor data that it collects through its workspace.',
          ],
        },
        {
          title: '5. Sharing and service providers',
          paragraphs: [
            'We do not sell personal information. We may share information with service providers that help us run ChurchOnline, including cloud hosting and database services, email delivery, SMS delivery, payment processing, mapping services, analytics, and security providers. These providers are expected to protect information and use it only for the services they provide.',
            'We may also disclose information where required by law, where necessary to protect rights or safety, or as part of a merger, acquisition, or transfer of the service. A church may choose to make certain information public, such as its church profile, events, sermons, or prayer-wall content.',
          ],
        },
        {
          title: '6. International processing',
          paragraphs: [
            'Our service providers may process information in countries other than Kenya. Where this happens, we take reasonable steps to ensure that the information receives appropriate protection and that transfers comply with applicable data-protection law.',
          ],
        },
        {
          title: '7. Security',
          paragraphs: [
            'We use technical and organisational safeguards designed to protect personal information, including access controls, encrypted connections, row-level access restrictions, and monitoring. No system can be completely secure, so you should use a strong password and protect your account and church workspace credentials.',
          ],
        },
        {
          title: '8. Retention and deletion',
          paragraphs: [
            'We retain information for as long as needed to provide the service, meet legal or accounting requirements, resolve disputes, and maintain security. Retention periods may depend on the type of information and the church\u2019s settings.',
            'When an account or church is deleted, we may keep limited records for a reasonable period where required for legal, financial, security, or backup purposes before securely deleting or anonymising the data.',
          ],
        },
        {
          title: '9. Your rights',
          paragraphs: [
            'Subject to applicable law, you may have the right to access, correct, delete, restrict, or object to the processing of your personal information, and to request a portable copy of information you provided. You may also withdraw consent where processing is based on consent.',
            'To exercise a right, contact us using the details below. If your request concerns information held within a church workspace, we may need to refer it to that church. You may also complain to the Office of the Data Protection Commissioner in Kenya or another competent authority.',
          ],
        },
        {
          title: '10. Children and church member records',
          paragraphs: [
            'ChurchOnline accounts are intended for adults acting for themselves or for a church. Churches may record information about children and other family members as part of their ministry and safeguarding activities. Those churches are responsible for obtaining any required guardian consent and for limiting access to that information.',
          ],
        },
        {
          title: '11. Cookies and similar technologies',
          paragraphs: [
            'We use cookies and similar technologies that are necessary for authentication, session management, security, theme preferences, and basic functionality. We may also use limited analytics or error-monitoring tools to understand and improve the service. You can control cookies through your browser, but disabling essential cookies may prevent the service from working properly.',
          ],
        },
        {
          title: '12. Changes to this policy',
          paragraphs: [
            'We may update this Privacy Policy to reflect changes in the service, legal requirements, or our data practices. When we make a material change, we will update the effective date and may ask you to review and accept the revised policy.',
          ],
        },
        {
          title: '13. Contact us',
          paragraphs: [
            `For privacy questions, requests, or concerns, contact ${LEGAL_CONTACT_EMAIL} or use our contact page. We will respond within a reasonable period and in line with applicable law.`,
          ],
        },
      ]}
    />
  )
}
