import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import '../static/css/layout.css';

const Footer = () => {
  const footerRef = useRef(null);

  useEffect(() => {
    // Initialize GSAP configurations
    gsap.config({
      nullTargetWarn: false,
    });

    // Add event listeners for interactive elements in footer
    const interactiveElements = footerRef.current.querySelectorAll('button, a, input');
    
    interactiveElements.forEach(element => {
      element.addEventListener('mouseenter', () => {
        gsap.to('.cursor', {
          scale: 1.5,
          duration: 0.2
        });
      });

      element.addEventListener('mouseleave', () => {
        gsap.to('.cursor', {
          scale: 1,
          duration: 0.2
        });
      });

      if (element.tagName === 'INPUT') {
        element.addEventListener('focus', () => {
          document.querySelector('.cursor')?.classList.add('focused');
        });

        element.addEventListener('blur', () => {
          document.querySelector('.cursor')?.classList.remove('focused');
        });
      }
    });

    // Cleanup
    return () => {
      interactiveElements.forEach(element => {
        element.removeEventListener('mouseenter', () => {});
        element.removeEventListener('mouseleave', () => {});
        if (element.tagName === 'INPUT') {
          element.removeEventListener('focus', () => {});
          element.removeEventListener('blur', () => {});
        }
      });
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add newsletter submission logic here
  };

  return (
    <footer className="container_width" ref={footerRef}>
      <div className="footer_top">
        <div className="footer_info">
          <p className="footer_email primaryfont">info@eclipseer.com</p>
          <p className="footer_phone_number primaryfont">(+92) 3165165608</p>
          <div className="social_links_footer">
            <a href="#" className="social_link">Instagram <i className="ri-arrow-right-line"></i></a>
            <a href="#" className="social_link">Facebook <i className="ri-arrow-right-line"></i></a>
            <a href="#" className="social_link">LinkedIn <i className="ri-arrow-right-line"></i></a>
          </div>
        </div>
        <div className="footer_newsletter">
          <h3 className="primaryfont">NEWSLETTER</h3>
          <form onSubmit={handleSubmit} className="footer_newsletter_form">
            <div className="footer_form_group">
              <input 
                className="primaryfont" 
                type="email" 
                id="email" 
                name="email" 
                required
                placeholder="Email Address*"
              />
            </div>
            <button type="submit" className="button_primary submit_btn">Submit</button>
          </form>
        </div>
      </div>
      <div className="footer_bottom">
        <p className="primaryfont">Eclipseer - © 2025</p>
        <button className="footer_bottom_btn" onClick={handleScrollToTop}>
          <i className="ri-arrow-up-line"></i>
        </button>
      </div>
    </footer>
  );
};

export default Footer;
