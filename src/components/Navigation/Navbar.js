import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import eclipseerlogo from './eclipseer-logo.png';
import '../static/css/layout.css';
import gsap from 'gsap';

const Navbar = () => {
  const [isCookieAccepted, setIsCookieAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Custom cursor setup
    const cursor = document.createElement('div');
    cursor.classList.add('cursor');
    document.body.appendChild(cursor);

    let cursorX = 0, cursorY = 0;

    const updateCursorPosition = (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
    };

    // Event listeners for cursor
    document.addEventListener('mousemove', updateCursorPosition);
    
    // Interactive elements cursor effects
    const interactiveElements = document.querySelectorAll('button, a, input, textarea, select');
    interactiveElements.forEach(element => {
      element.addEventListener('mouseenter', () => {
        gsap.to(cursor, { scale: 1.5, duration: 0.2 });
        cursor.classList.add('pointer');
      });
      element.addEventListener('mouseleave', () => {
        gsap.to(cursor, { scale: 1, duration: 0.2 });
        cursor.classList.remove('pointer');
      });
    });

    // Check cookie notice state
    setIsCookieAccepted(localStorage.getItem('hidecookiebar') === '1');

    // Hide loader after delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => {
      document.removeEventListener('mousemove', updateCursorPosition);
      document.body.removeChild(cursor);
      clearTimeout(timer);
    };
  }, []);

  const handleCookieAccept = () => {
    localStorage.setItem('hidecookiebar', '1');
    setIsCookieAccepted(true);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      {isLoading && (
        <div id="loader-wrapper">
          <div className="loader"></div>
        </div>
      )}

      <header>
        <nav className="nav_container container_width">
          <div className="nav">
            <div className="nav_logo">
              <Link to="/home"><img src={eclipseerlogo} alt="Eclispeer Logo" /></Link>
            </div>
            <div className="nav_links">
              <Link to="/home" className="nav_link active_link">HOME</Link>
              <a href="#services" className="nav_link">SERVICES</a>
              <a href="#about" className="nav_link">ABOUT</a>
              <a href="#contact" className="nav_link">CONTACT</a>
              <Link to="/login" className="nav_link button_primary">Sign In</Link>
              <button 
                id="menu-toggle" 
                className={`${isMobileMenuOpen ? 'menu-toggle--open' : ''}`}
                onClick={toggleMobileMenu}
              >
                <div className="menu-toggle__bar1"></div>
                <div className="menu-toggle__bar2"></div>
                <div className="menu-toggle__bar3"></div>
              </button>
            </div>
          </div>
        </nav>

        <div className={`mobile_nav container_width ${isMobileMenuOpen ? 'nav--open' : ''}`}
             style={{ 
               maxHeight: isMobileMenuOpen ? '300px' : '0',
               opacity: isMobileMenuOpen ? '1' : '0'
             }}>
          <Link to="/home">Home</Link>
          <hr />
          <a href="#services" className="nav_link">SERVICES</a>
          <hr />
          <a href="#about" className="nav_link">ABOUT</a>
          <hr />
          <a href="#contact" className="nav_link">CONTACT</a>
          <hr />
          <Link to="/login">Sign In</Link>
        </div>
      </header>

      {!isCookieAccepted && (
        <div id="cookienew-notice">
          <p>
            This website uses cookies to provide you with the best possible experience. 
            By clicking 'Accept', you acknowledge the use of cookies and agree to our{' '}
            <Link to="/privacypolicy">Privacy Policy</Link>.
          </p>
          <button id="i-accept" onClick={handleCookieAccept}>
            Accept
          </button>
        </div>
      )}
    </>
  );
};

export default Navbar;
