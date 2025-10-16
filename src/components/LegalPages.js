import React, { useState, useEffect } from 'react';
// Corrected import paths to be relative to the new file location.
import './static/css/layout.css';

import './static/css/homepage.css';
import navlogo from './static/assets/navlogo.png';

// --- Shared Components ---

const Navbar = ({ setActivePage }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="nav_container">
            <nav className="nav">
                <div className="nav_logo">
                    <a href="/" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}>
                        <img src={navlogo} alt="Eclipseer Logo" />
                    </a>
                </div>
                <div className="nav_links">
                    <a href="/#about" className="nav_link">About</a>
                    <a href="/#services" className="nav_link">Services</a>
                    <a href="/#contact" className="nav_link">Contact</a>
                    <a href="/account" className="button_primary">Login</a>
                </div>
                <div id="menu-toggle" className={`menu-toggle ${isMenuOpen ? 'menu-toggle--open' : ''}`} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    <div className="menu-toggle__bar1"></div>
                    <div className="menu-toggle__bar2"></div>
                    <div className="menu-toggle__bar3"></div>
                </div>
            </nav>
            <div className={`mobile_nav ${isMenuOpen ? 'nav--open' : ''}`} style={{maxHeight: isMenuOpen ? '300px' : '0', opacity: isMenuOpen ? '1' : '0'}}>
                <a href="/#about">About</a>
                <hr />
                <a href="/#services">Services</a>
                <hr />
                <a href="/#contact">Contact</a>
                <hr />
                <a href="/account">Login</a>
            </div>
        </header>
    );
};

const Footer = ({ setActivePage }) => {
    return (
        <footer>
            <div className="container_width">
                <div className="footer_top">
                    <div className="footer_info">
                        <p className="footer_email">info@eclipseer.com</p>
                        <p className="footer_phone_number">+92 316 516 5672</p>
                        <div className="social_links_footer">
                            <a href="#" className="social_link">Instagram <i className="ri-arrow-right-line"></i></a>
                            <a href="#" className="social_link">Facebook <i className="ri-arrow-right-line"></i></a>
                            <a href="#" className="social_link">LinkedIn <i className="ri-arrow-right-line"></i></a>
                        </div>
                    </div>
                    <div className="footer_newsletter">
                        <h3>Stay up to date</h3>
                        <form className="footer_newsletter_form">
                            <div className="footer_form_group">
                                <input type="email" placeholder="Enter your email" required />
                            </div>
                            <button type="submit" className="button_primary submit_btn">Subscribe</button>
                        </form>
                    </div>
                </div>
                <div className="footer_bottom">
                    <p className="pTag">&copy; 2025 Eclipseer. All rights reserved.</p>
                    <div className="footer_bottom_links" style={{display: 'flex', flexWrap: 'wrap', gap: '10px'}}>
                        <a href="#terms" onClick={(e) => {e.preventDefault(); setActivePage('terms')}}>T&Cs</a> |
                        <a href="#privacy" onClick={(e) => {e.preventDefault(); setActivePage('privacy')}}>Privacy Policy</a> |
                        <a href="#cookies" onClick={(e) => {e.preventDefault(); setActivePage('cookies')}}>Cookie Policy</a> |
                        <a href="#community" onClick={(e) => {e.preventDefault(); setActivePage('community')}}>Community Guidelines</a> |
                        <a href="#dpa" onClick={(e) => {e.preventDefault(); setActivePage('dpa')}}>DPA</a> |
                        <a href="#eula" onClick={(e) => {e.preventDefault(); setActivePage('eula')}}>EULA</a> |
                         <a href="#rewards" onClick={(e) => {e.preventDefault(); setActivePage('rewards')}}>Rewards</a> |
                        <a href="#sla" onClick={(e) => {e.preventDefault(); setActivePage('sla')}}>SLA</a> |
                        <a href="#ai" onClick={(e) => {e.preventDefault(); setActivePage('ai')}}>AI Policy</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

const LegalPageLayout = ({ title, children, setActivePage }) => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <Navbar setActivePage={setActivePage} />
            <main className="container_width" style={{ paddingTop: '50px', paddingBottom: '100px', color: 'white' }}>
                <div className="section_header">
                    <h1 className="section_title primaryfont" style={{ textAlign: 'left', width: '100%' }}>{title}</h1>
                    <hr style={{ margin: '20px 0' }}/>
                </div>
                <div className="legal-content" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                    {children}
                </div>
            </main>
            <Footer setActivePage={setActivePage} />
        </>
    );
};


// --- Individual Legal Page Components ---

const TermsAndConditions = ({ setActivePage }) => (
    <LegalPageLayout title="Terms & Conditions" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">Welcome to Eclipseer, a research and engagement platform operated by Eclipse Labs Limited, a company registered in England and Wales (Company No: 16064528) with its registered office at 71–75 Shelton Street, Covent Garden, London, WC2H 9JQ (“Eclipseer,” “we,” “us,” or “our”).</p>
        <p className="pTag">By creating an account or using the Eclipseer platform (the “Platform”), you agree to be bound by these Terms & Conditions (“Terms”).</p>
        
        <h2>1. Eligibility & Accounts</h2>
        <ul>
            <li>The Platform is available only to individuals aged 16 or older.</li>
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>You may only maintain one account. Fake or duplicate accounts are prohibited.</li>
        </ul>

        <h2>2. Role Types</h2>
        <ul>
            <li><strong>Business Admins:</strong> may create surveys, quests, campaigns, and access analytics.</li>
            <li><strong>Participants:</strong> may complete surveys, quests, bug reports, or feature requests in exchange for XP, raffle entries, or instant rewards.</li>
        </ul>

        <h2>3. Use of the Platform</h2>
        <ul>
            <li>You agree to use the Platform only for lawful purposes.</li>
            <li>Prohibited uses include: creating fake survey responses, manipulating raffles, using bots, reverse engineering the Platform, or submitting abusive content.</li>
            <li>We may suspend or terminate accounts for violations.</li>
        </ul>
        <h3>3.1 Community Guidelines</h3>
        <p className="pTag">All users must comply with our <a href="#community" onClick={(e) => { e.preventDefault(); setActivePage('community'); }}>Community Guidelines</a>. Breaches of the Community Guidelines may result in warnings, suspension, or permanent account termination.</p>

        <h2>4. Rewards, XP & Raffles</h2>
        <ul>
            <li>XP is a virtual points system with no cash value outside the Platform.</li>
            <li>Rewards and raffles are subject to availability and may change.</li>
            <li>Raffles are governed separately by our <a href="#rewards" onClick={(e) => { e.preventDefault(); setActivePage('rewards'); }}>Reward & Raffle Terms</a>.</li>
        </ul>

        <h2>5. Services for Business Admins</h2>
        <ul>
            <li>Admins pay for access via: License fees (monthly or annual), and Usage fees (e.g., per participant engaged).</li>
            <li>Non-payment may result in suspension of access.</li>
        </ul>

        <h2>6. AI Tools</h2>
        <ul>
            <li>AI-powered features are advisory only.</li>
            <li>We do not guarantee accuracy, completeness, or fitness for business decisions.</li>
        </ul>
        <h3>6.1. AI Use Policy</h3>
        <p className="pTag">Business Admins must comply with our <a href="#ai" onClick={(e) => { e.preventDefault(); setActivePage('ai'); }}>AI Use Policy</a>, which forms part of these Terms & Conditions. The AI Use Policy explains the limitations of AI outputs and the responsibilities of Business Admins when using AI features.</p>
        
        <h2>7. User Submissions (Bug Reports, Feature Requests, Ideas & Co-Creation)</h2>
        <p className="pTag">By submitting bug reports, feature requests, ideas, or similar suggestions (“Submissions”), you grant Eclipseer and the relevant Business Admin a worldwide, royalty-free, non-exclusive license to use, edit, publish, and display your Submission. All Submissions are deemed non-confidential and non-proprietary. You acknowledge that Eclipseer does not provide compensation for Submissions.</p>

        <h2>8. Data Collection & Privacy</h2>
        <p className="pTag">We collect and process personal data in accordance with our <a href="#privacy" onClick={(e) => { e.preventDefault(); setActivePage('privacy'); }}>Privacy Policy</a>.</p>

        <h2>9. Intellectual Property</h2>
        <p className="pTag">All intellectual property in the Platform belongs to Eclipseer or its licensors. Use of the software is subject to the <a href="#eula" onClick={(e) => { e.preventDefault(); setActivePage('eula'); }}>End User License Agreement (EULA)</a>.</p>
        
        <h2>10. Limitation of Liability</h2>
        <p className="pTag">To the maximum extent permitted by law, Eclipseer is not liable for indirect losses or reliance on AI outputs. Our total liability is capped at the greater of: (a) £100 or (b) the amount paid by you to Eclipseer in the 12 months before the claim.</p>

        <h2>11. Governing Law & Jurisdiction</h2>
        <p className="pTag">These Terms are governed by the laws of England and Wales. Disputes are subject to the exclusive jurisdiction of the English courts.</p>

        <h2>12. Changes</h2>
        <p className="pTag">We may update these Terms. Continued use constitutes acceptance of changes.</p>
    </LegalPageLayout>
);

const PrivacyPolicy = ({ setActivePage }) => (
    <LegalPageLayout title="Privacy Policy" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">Eclipse Labs Limited (“Eclipseer”, “we”, “us”) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard personal data.</p>
        
        <h2>1. Data Controller</h2>
        <p className="pTag">Eclipse Labs Limited, UK. Contact: info@eclipseer.com</p>
        
        <h2>2. Data We Collect</h2>
        <ul>
            <li><strong>Participants:</strong> profile tags (interests, devices), survey/quest responses, XP earned, bug/feature submissions, engagement history, device/browser info.</li>
            <li><strong>Business Admins:</strong> account info, billing/payment details, survey/quest content, usage data.</li>
            <li><strong>General:</strong> cookies, IP addresses, location (approximate), analytics data.</li>
        </ul>

        <h2>3. How We Use Data</h2>
        <p className="pTag">We use data to provide and improve the Platform, generate aggregated survey reports, deliver rewards, send service updates and promotional emails (opt-out available), and ensure compliance and security.</p>

        <h2>4. Sharing of Data</h2>
        <p className="pTag">We may share data with Business Admins, service providers (like AWS for hosting), legal authorities when required, and third-party platforms (like Discord, Instagram) when you opt into quests.</p>

        <h2>5. International Transfers</h2>
        <p className="pTag">Data is hosted on AWS UK/EU servers. If transferred outside the UK/EU, we use Standard Contractual Clauses (SCCs) as a safeguard.</p>

        <h2>6. Your Rights</h2>
        <p className="pTag">You have the right to access, correct, or delete your data, object to or restrict processing, request data portability, withdraw consent at any time, and complain to the UK Information Commissioner’s Office (ICO).</p>

        <h2>7. Retention</h2>
        <p className="pTag">Data is retained while accounts remain active. Survey data may be stored for up to 5 years. Users can request deletion at any time.</p>

        <h2>8. Security</h2>
        <p className="pTag">We use encryption, secure hosting, and access controls to protect your data.</p>

        <h2>9. Cookies</h2>
        <p className="pTag">See our <a href="#cookies" onClick={(e) => { e.preventDefault(); setActivePage('cookies'); }}>Cookie Policy</a>.</p>
    </LegalPageLayout>
);

const CommunityGuidelines = ({ setActivePage }) => (
    <LegalPageLayout title="Community Guidelines / Code of Conduct" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">Eclipseer is built on respect and fairness. These Community Guidelines (“Guidelines”) apply to all participants across surveys, quests, comments, bug/feature submissions, and linked communities (e.g., Discord). By using Eclipseer, you agree to follow these Guidelines.</p>
        
        <h2>1. Respect Others</h2>
        <p className="pTag">No harassment, hate speech, discrimination, threats, or personal attacks. No offensive, pornographic, violent, or otherwise unlawful content.</p>
        
        <h2>2. Honesty & Fair Use</h2>
        <p className="pTag">Do not create multiple accounts or use bots. Do not submit false survey responses, fake bug reports, or manipulate raffles. Do not impersonate other people, brands, or organisations.</p>
        
        <h2>3. Intellectual Property</h2>
        <p className="pTag">Only share content you own or have rights to share. Submissions (bugs, features, comments) grant Eclipseer a royalty-free license to use, adapt, or publish them.</p>

        <h2>4. Safety & Security</h2>
        <p className="pTag">Do not attempt to hack, exploit, or disrupt the Platform. Do not share your own or others’ personal information in public areas.</p>

        <h2>5. Enforcement</h2>
        <p className="pTag">Violations may result in warnings, suspension, or permanent account bans. Severe breaches may be reported to legal authorities.</p>

        <h2>6. Reporting Misconduct</h2>
        <p className="pTag">If you see inappropriate behaviour, please report it to info@eclipseer.com.</p>
    </LegalPageLayout>
);

const CookiePolicy = ({ setActivePage }) => (
    <LegalPageLayout title="Cookie Policy" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">We use cookies and tracking technologies to enhance your experience.</p>

        <h2>1. What Are Cookies?</h2>
        <p className="pTag">Cookies are small files stored on your device when visiting a site.</p>

        <h2>2. Types We Use</h2>
        <ul>
            <li><strong>Strictly Necessary:</strong> For log-in, account security.</li>
            <li><strong>Performance & Analytics:</strong> Google Analytics, Mixpanel, Hotjar.</li>
            <li><strong>Advertising/Remarketing:</strong> Google Ads, Meta Ads.</li>
            <li><strong>Social Media:</strong> Discord, YouTube, Instagram, X.</li>
        </ul>

        <h2>3. How We Use Them</h2>
        <p className="pTag">To keep you signed in, measure engagement and traffic, deliver targeted promotions, and enable sharing features.</p>

        <h2>4. Managing Cookies</h2>
        <p className="pTag">A consent banner is shown on your first visit. You can accept or reject non-essential cookies. Browser settings also allow you to block cookies at any time.</p>
    </LegalPageLayout>
);

const DataProcessingAgreement = ({ setActivePage }) => (
    <LegalPageLayout title="Data Processing Agreement (DPA)" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">This Data Processing Agreement (“DPA”) forms part of the Terms & Conditions and governs the processing of personal data when Business Admins (“Controller”) use Eclipseer (“Processor”) to collect and analyse participant data.</p>

        <h2>1. Roles</h2>
        <p className="pTag">Business Admins act as Data Controllers. Eclipseer (Eclipse Labs Limited, UK) acts as Data Processor. Controllers determine the purpose and lawful basis of processing.</p>

        <h2>2. Subject Matter & Duration</h2>
        <p className="pTag">We process participant data for surveys, quests, and analytics. Processing continues while the Controller has an active account.</p>

        <h2>3. Nature & Purpose</h2>
        <p className="pTag">Collection of survey responses, data filtering, export of raw or aggregated data, and AI-powered analytics.</p>

        <h2>4. Categories of Data</h2>
        <p className="pTag">Participant profile info, survey responses, engagement logs, and submissions. Controllers are solely responsible for lawfully collecting any sensitive data.</p>
        
        <h2>5. Security</h2>
        <p className="pTag">Processor shall host data on AWS UK/EU servers, encrypt data, maintain access controls, and ensure staff confidentiality.</p>

        <h2>6. Subprocessors</h2>
        <p className="pTag">We may engage subprocessors (e.g., AWS, analytics providers). A list is available upon request.</p>

        <h2>7. International Transfers</h2>
        <p className="pTag">If data is transferred outside the UK/EU, we implement safeguards like Standard Contractual Clauses.</p>
        
        <h2>8. Data Retention</h2>
        <p className="pTag">We will retain personal data for a maximum of three years from the date of collection, after which it will be deleted or irreversibly anonymised.</p>

        <h2>9. Governing Law</h2>
        <p className="pTag">This DPA is governed by the laws of England and Wales.</p>
    </LegalPageLayout>
);

const EULA = ({ setActivePage }) => (
    <LegalPageLayout title="End User License Agreement (EULA)" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">This End User License Agreement (“EULA”) is a legal agreement between you (“User”) and Eclipse Labs Limited. It governs your right to use the Eclipseer software platform.</p>

        <h2>1. License Grant</h2>
        <p className="pTag">Subject to your compliance with this EULA and our Terms & Conditions, Eclipseer grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Software for your internal business or personal research purposes.</p>

        <h2>2. Restrictions</h2>
        <p className="pTag">You may not copy, modify, distribute, reverse-engineer, decompile, sell, rent, or otherwise exploit the Software. You may not use it to build a competing product.</p>

        <h2>3. Ownership</h2>
        <p className="pTag">The Software is licensed, not sold. Eclipseer and its licensors retain all rights to the Software and its intellectual property.</p>

        <h2>4. Termination</h2>
        <p className="pTag">This license automatically terminates if you breach this EULA or the Terms & Conditions, or fail to maintain an active subscription.</p>

        <h2>5. Disclaimer & Liability</h2>
        <p className="pTag">The Software is provided “as is.” Our liability is limited as set out in the Terms & Conditions.</p>

        <h2>6. Governing Law</h2>
        <p className="pTag">This EULA is governed by the laws of England and Wales.</p>
    </LegalPageLayout>
);

const RewardAndRaffleTerms = ({ setActivePage }) => (
    <LegalPageLayout title="Reward & Raffle Terms" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">These terms govern XP, rewards, and raffles on Eclipseer.</p>

        <h2>1. Eligibility</h2>
        <p className="pTag">Available globally, except where prohibited by sanctions or local law (e.g., North Korea, Iran, Syria, Cuba, Crimea region). Users must be 16+.</p>

        <h2>2. XP & Rewards</h2>
        <p className="pTag">XP has no monetary value and cannot be converted to cash. It is redeemable only within Eclipseer for raffles, vouchers, or instant rewards.</p>

        <h2>3. Raffles</h2>
        <p className="pTag">Entry requires XP; no purchase necessary. Each entry is a chance to win, not a guarantee. Winners are selected randomly.</p>
        
        <h2>4. Prizes</h2>
        <p className="pTag">Eclipseer covers shipping & handling. Winners are responsible for local import taxes/duties. Prizes cannot be exchanged for cash or transferred.</p>
        
        <h2>5. Fraud & Abuse</h2>
        <p className="pTag">Multiple/fake accounts, bots, or fraud will result in disqualification. We may cancel or modify raffles at any time.</p>
        
        <h2>6. Liability</h2>
        <p className="pTag">We are not responsible for lost shipments or third-party delays. Our liability is capped at the prize value.</p>
        
        <h2>7. Governing Law</h2>
        <p className="pTag">Governed by the laws of England and Wales.</p>
    </LegalPageLayout>
);

const ServiceLevelAgreement = ({ setActivePage }) => (
    <LegalPageLayout title="Service Level Agreement (SLA)" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">This Service Level Agreement (“SLA”) describes the service levels for the Eclipseer platform.</p>
        
        <h2>1. Service Availability</h2>
        <p className="pTag">Eclipseer will use commercially reasonable efforts to make the Platform available with a monthly uptime of 99%. This excludes planned maintenance, emergency maintenance, and downtime caused by third-party services or events beyond our control.</p>

        <h2>2. Support</h2>
        <p className="pTag">Support is available via email at info@eclipseer.com. We will use commercially reasonable efforts to respond in a timely manner, but no specific response times are guaranteed. Urgent issues will be prioritised.</p>

        <h2>3. AI Services</h2>
        <p className="pTag">AI-powered features depend on third-party providers. Their availability is not guaranteed, and downtime from these providers is excluded from our uptime calculation.</p>

        <h2>4. Remedies</h2>
        <p className="pTag">If monthly uptime falls below 99%, Eclipseer may, at its discretion, provide service credits or participant panel discounts. This is the sole remedy for service issues.</p>
        
        <h2>5. Governing Law</h2>
        <p className="pTag">This SLA is governed by the laws of England and Wales.</p>
    </LegalPageLayout>
);

const AiUsePolicy = ({ setActivePage }) => (
    <LegalPageLayout title="AI Use Policy / Disclaimer" setActivePage={setActivePage}>
        <p className="pTag"><strong>Last Updated: September 1, 2025</strong></p>
        <p className="pTag">This AI Use Policy governs the use of Eclipseer’s artificial intelligence (“AI”) features by Business Admins. By using our AI tools, you agree to this Policy.</p>

        <h2>1. Advisory Nature of AI</h2>
        <p className="pTag">AI outputs are generated automatically and are for informational purposes only. They may be inaccurate, incomplete, biased, or outdated and do not constitute legal, medical, financial, or professional advice.</p>

        <h2>2. Business Admin Responsibility</h2>
        <p className="pTag">Business Admins are fully responsible for how they use AI outputs. All AI outputs must be reviewed and approved by a human before being used, published, or relied upon. Eclipseer is not liable for any losses resulting from reliance on AI outputs.</p>

        <h2>3. Data Inputs & Sensitive Information</h2>
        <p className="pTag">Business Admins may input personal or sensitive data into AI features only if they have a lawful basis (e.g., consent under GDPR). AI prompts and outputs may be logged for up to twelve months for audit and support purposes.</p>
        
        <h2>4. Liability</h2>
        <p className="pTag">To the fullest extent permitted by law, Eclipseer’s liability for AI features is limited as set out in the Terms & Conditions. We are not liable for inaccurate outputs or business decisions based on them.</p>
    </LegalPageLayout>
);


// --- Main App Component ---

export default function App() {
    const [activePage, setActivePage] = useState('terms'); // Default page

    // This effect will update the page based on the URL hash
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            const validPages = ['terms', 'privacy', 'community', 'cookies', 'dpa', 'eula', 'rewards', 'sla', 'ai'];
            if (validPages.includes(hash)) {
                setActivePage(hash);
            } else {
                setActivePage('terms'); // Default to terms if hash is invalid or not present
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial check on component mount

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, []);

    const updateActivePage = (page) => {
        setActivePage(page);
        window.location.hash = page;
    }

    const renderPage = () => {
        switch (activePage) {
            case 'terms':
                return <TermsAndConditions setActivePage={updateActivePage} />;
            case 'privacy':
                return <PrivacyPolicy setActivePage={updateActivePage} />;
            case 'community':
                return <CommunityGuidelines setActivePage={updateActivePage} />;
            case 'cookies':
                return <CookiePolicy setActivePage={updateActivePage} />;
            case 'dpa':
                return <DataProcessingAgreement setActivePage={updateActivePage} />;
            case 'eula':
                return <EULA setActivePage={updateActivePage} />;
            case 'rewards':
                return <RewardAndRaffleTerms setActivePage={updateActivePage} />;
            case 'sla':
                 return <ServiceLevelAgreement setActivePage={updateActivePage} />;
            case 'ai':
                 return <AiUsePolicy setActivePage={updateActivePage} />;
            default:
                return <TermsAndConditions setActivePage={updateActivePage} />;
        }
    };

    return (
        <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh' }}>
            {renderPage()}
        </div>
    );
}

