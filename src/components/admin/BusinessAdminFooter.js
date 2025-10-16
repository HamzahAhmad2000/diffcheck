import React from 'react';
import '../../styles/b_admin_styling.css';

const BusinessAdminFooter = () => {
  return (
    <footer className="b_admin_styling-footer">
      <div className="b_admin_styling-footer-content">
        <div className="b_admin_styling-footer-links">
          <a
            href="/legal#terms"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Terms & Conditions
          </a>
          <a
            href="/legal#privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Privacy Policy
          </a>
          <a
            href="/legal#cookies"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Cookie Policy
          </a>
          <a
            href="/legal#community"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Community Guidelines
          </a>
          <a
            href="/legal#dpa"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Data Processing Agreement
          </a>
          <a
            href="/legal#eula"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            End User License Agreement
          </a>
          <a
            href="/legal#rewards"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Reward & Raffle Terms
          </a>
          <a
            href="/legal#sla"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            Service Level Agreement
          </a>
          <a
            href="/legal#ai"
            target="_blank"
            rel="noopener noreferrer"
            className="b_admin_styling-footer-link"
          >
            AI Use Policy
          </a>
        </div>
      </div>
    </footer>
  );
};

export default BusinessAdminFooter;
