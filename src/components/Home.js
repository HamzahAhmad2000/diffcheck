import React, { useEffect, useState } from 'react';
import Navbar from './Navigation/Navbar';
import Footer from './Navigation/Footer';
import './static/css/homepage.css';
import testimonial1 from './static/assets/testimonial_1.png';
import testimonial2 from './static/assets/testimonial_2.png';
import HeroRight from './static/assets/HeroRight.gif';
import heroCard1 from './static/assets/herocard1.png';
import heroCard2 from './static/assets/herocard2.png';
import heroCard3 from './static/assets/herocard3.png';
import whyUsPoint1 from './static/assets/whyuspoint1.png';
import testimonialQuote from './static/assets/testimonial_quote.png';
import services11 from './static/assets/services_1_1.png';
import services12 from './static/assets/services_1_2.png';
import services13 from './static/assets/services_1_3.png';
import videothumbnail from './static/assets/videos/image1.png';
import services2 from './static/assets/services_2.svg';
import services3 from './static/assets/service3.svg';
import services4 from './static/assets/service4.svg';
import service41 from './static/assets/service41.svg';
import service42 from './static/assets/service42.svg';
import service43 from './static/assets/service43.svg';
import service44 from './static/assets/service44.svg';
import s41text from './static/assets/41text.svg';
import s42text from './static/assets/42text.svg';
import s43text from './static/assets/43text.svg';
import s44text from './static/assets/44text.svg';

import graph from './static/assets/graph.svg';
import graphTrail from './static/assets/graphtrail.svg';
import purpleRect from './static/assets/purplerect.svg';
import grayRect from './static/assets/grayrect.svg';
import plus30 from './static/assets/30.svg';
import increaseText from './static/assets/Increase.svg';
import revenueText from './static/assets/revenue.svg';
import amount from './static/assets/300000.svg';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 2; // Update to match actual number of testimonials

  // Custom carousel controls
  const nextSlide = () => {
    if (currentSlide < testimonials.length - 2) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // State for active indicators and service cards
  const [activeIndicator, setActiveIndicator] = useState('1');
  const [activeServiceCard, setActiveServiceCard] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [activeSlide, setActiveSlide] = useState('1');
  const [serviceView, setServiceView] = useState('business'); // for pill button

  // Testimonial data
  const testimonials = [
    {
      name: "Mike Smith",
      image: testimonial1,
      quote: "Throughout our collaboration, Eclipseer's dedication to exceptional results was evident. Our portfolio now exceeds expectations, thanks to their expertise."
    },
    {
      name: "Amanda Green",
      image: testimonial2,
      quote: "Throughout our collaboration, Eclipseer's dedication to exceptional results was evident. Our portfolio now exceeds expectations, thanks to their expertise."
    },
    {
      name: "Mike Smiths",
      image: testimonial1,
      quote: "Throughout our collaboration, Eclipseer's dedication to exceptional results was evident. Our portfolio now exceeds expectations, thanks to their expertise."
    },
    {
      name: "Amanda Greens",
      image: testimonial2,
      quote: "Throughout our collaboration, Eclipseer's dedication to exceptional results was evident. Our portfolio now exceeds expectations, thanks to their expertise."
    }
  ];

  // Why Us slides data
  const whyUsSlides = [
    {
      id: '1',
      title: "Help customers make easy money and businesses get insightful results",
      description: "Eclipseer bridges the gap between businesses seeking actionable insights and participants looking to earn rewards. With cutting-edge AI, we make the process seamless, impactful, and rewarding for all parties.",
      highlightedText: "rewarding for all parties.",
      detailsTitle: "Earn rewards for your opinions without hassle",
      detailsDesc: "Flexible cash-out options tailored to your preferences. Join a global community of valued contributors.",
      image: whyUsPoint1
    },
    {
      id: '2',
      title: "Help customers make easy money and businesses get insightful results",
      description: "Our platform uses advanced algorithms to match surveys with the right participants, ensuring high-quality responses and valuable insights.",
      highlightedText: "high-quality responses and valuable insights.",
      detailsTitle: "Earn rewards for your opinions without hassle 1",
      detailsDesc: "Flexible cash-out options tailored to your preferences. Join a global community of valued contributors.",
      image: heroCard1
    },
    {
      id: '3',
      title: "Help customers make easy money and businesses get insightful results",
      description: "Join thousands of satisfied users who have already discovered the easiest way to earn rewards while helping businesses grow.",
      highlightedText: "earn rewards while helping businesses grow.",
      detailsTitle: "Earn rewards for your opinions without hassle 2",
      detailsDesc: "Flexible cash-out options tailored to your preferences. Join a global community of valued contributors.",
      image: heroCard1
    }
  ];

  // Services data
  const services = [
    {
      title: "Usability Tests",
      description: "Evaluate how easily users navigate and interact with your product.",
      link: "#"
    },
    // ...add other services
  ];

  // Videos data
  const videos = [
    {
      index: "01",
      title: "VIDEO TITLE ONE",
      description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultrices mollis",
      thumbnail: "/static/assets/videos/image1.png"
    },
    {
      index: "02",
      title: "VIDEO TITLE TWO",
      description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultrices mollis",
      thumbnail: "/static/assets/videos/image1.png"
    },
    {
      index: "03",
      title: "VIDEO TITLE THREE",
      description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultrices mollis",
      thumbnail: "/static/assets/videos/image1.png"
    },
    {
      index: "04",
      title: "VIDEO TITLE FOUR",
      description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultrices mollis",
      thumbnail: "/static/assets/videos/image1.png"
    },
    {
      index: "05",
      title: "VIDEO TITLE FIVE",
      description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultrices mollis",
      thumbnail: "/static/assets/videos/image1.png"
    },
    // ...add other videos
  ];

  const logout = () => {
    const jwtToken = localStorage.getItem('jwt_token');
    const refreshToken = localStorage.getItem('refresh_token');
    if (!jwtToken || !refreshToken) {
      window.isLoggedIn = false;
      updateUI(false);
      return;
    }
    // ... rest of logout logic from homepage.js ...
  };

  const updateUI = (isLoggedIn) => {
    if (isLoggedIn) {
      // ... UI update logic from homepage.js ...
    } else {
      // ... UI update logic for logged out state ...
    }
  };

  const checkLoginStatus = async () => {
    let admin_token = localStorage.getItem('admin_key');
    if (admin_token) {
      window.location.href = '/admin';
      return;
    }
    // ... rest of checkLoginStatus logic from homepage.js ...
  };

  useEffect(() => {
    // Hero Section Animation
    const heroTimeline = gsap.timeline({
      defaults: {
        duration: 1.0,
        ease: "power3.out"
      }
    });
  
    heroTimeline
      .from(".hero_left", {
        x: -100,
        opacity: 0
      })
      .from(".stats_cards", {
        x: -100,
        opacity: 0
      }, "-=0.4")  // Start slightly before the previous animation ends
      .from(".hero_right", {
        x: 100,
        opacity: 0
      }, "-=0.6");  // Start slightly before the stats_cards animation ends
  
  }, []); 

  useEffect(() => {
    // Auto-advance pipeline steps
    const stepTimer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(stepTimer);
  }, []);

  useEffect(() => {
    // Auto-advance service cards
    let startTime;
    let animationFrameId;
    const ROTATION_INTERVAL = 5000; // 5 seconds per card

    const updateProgress = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed / ROTATION_INTERVAL) * 100;

      // Update progress bar of active card
      const activeCard = document.querySelector('.service_card.active');
      if (activeCard) {
        const progressBar = activeCard.querySelector('.progress_bar');
        if (progressBar) {
          progressBar.style.width = `${Math.min(progress, 100)}%`;
        }
      }

      if (progress >= 100) {
        startTime = timestamp;
        setActiveServiceCard((prev) => (prev + 1) % 8);
      }

      animationFrameId = requestAnimationFrame(updateProgress);
    };

    animationFrameId = requestAnimationFrame(updateProgress);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeServiceCard]);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  useEffect(() => {
    // Why Us Section Animation
    const whyUsTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".why_us_section",
        start: "top center",
        end: "+=300",
        toggleActions: "play none none reverse"
      }
    });

    whyUsTimeline
      .from(".section_title", {
        y: 50,
        opacity: 0,
        duration: 0.6
      })
      .from(".section_header hr", {
        scaleX: 0,
        duration: 0.6
      }, "-=0.3")
      .from(".slideshow_left", {
        x: -50,
        opacity: 0,
        duration: 0.6
      }, "-=0.3")
      .from(".slideshow_right", {
        x: 50,
        opacity: 0,
        duration: 0.6
      }, "-=0.3")
      .from(".slideshow_details_content", {
        y: 50,
        opacity: 0,
        duration: 0.6
      }, "-=0.3");
  }, []);

  useEffect(() => {
    // Services Section Animation
    const servicesTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: "#services_section_header",
        start: "top center+=100",
        end: "bottom center",
        toggleActions: "play none none none"
      }
    });

    // Header animation with no reversal
    servicesTimeline
      .fromTo("#services_section_header", 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
      .fromTo("#services_section_header hr", 
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6 },
        "-=0.3"
      )
      .fromTo(".pill_button__container", 
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      );

    // Create separate timeline for each service point
    const servicePoints = document.querySelectorAll('.services_point_content');
    servicePoints.forEach((point, index) => {
      gsap.timeline({
        scrollTrigger: {
          trigger: point,
          start: "top center+=100",
          toggleActions: "play none none none"
        }
      })
      .from(point.querySelector('.services_point_image'), {
        x: index % 2 === 0 ? -50 : 50,
        opacity: 0,
        duration: 0.8
      })
      .from(point.querySelector('.services_point_text'), {
        x: index % 2 === 0 ? 50 : -50,
        opacity: 0,
        duration: 0.8
      }, "-=0.5");
    });
  }, []);

  useEffect(() => {
    // Contact Section Animation
    const contactTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".contact_section",
        start: "top center+=100",
        toggleActions: "play none none none"
      }
    });

    // Header animation
    contactTimeline
      .fromTo(".contact_section .section_header", 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
      .fromTo(".contact_section .section_header hr", 
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6 },
        "-=0.3"
      )
      .fromTo(".pipeline_section", 
        { opacity: 0, x: -50 },
        { opacity: 1, x: 0, duration: 0.6 },
        "-=0.3"
      )
      .fromTo(".contact_form_section", 
        { opacity: 0, x: 50 },
        { opacity: 1, x: 0, duration: 0.6 },
        "-=0.6"
      );
  }, []);

  useEffect(() => {
    // Videos Section Animation
    const videosTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".videos_section",
        start: "top center+=100",
        toggleActions: "play none none none"
      }
    });

    // Header animation
    videosTimeline
      .fromTo(".videos_section .section_header", 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
      .fromTo(".videos_section .section_header hr", 
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6 },
        "-=0.3"
      );

    // Animate video items one by one
    const videoItems = document.querySelectorAll('.video_item');
    videoItems.forEach((item, index) => {
      videosTimeline.fromTo(item,
        { 
          opacity: 0, 
          x: index % 2 === 0 ? -50 : 50 
        },
        { 
          opacity: 1, 
          x: 0, 
          duration: 0.6 
        },
        "-=0.3"
      );
    });

    // Animate "More" link
    videosTimeline.fromTo(".more_link",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6 },
      "-=0.3"
    );
  }, []);

  useEffect(() => {
    // Testimonials Section Animation
    const testimonialsTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: ".testimonial_section",
        start: "top center+=100",
        toggleActions: "play none none none"
      }
    });

    // Header animation
    testimonialsTimeline
      .fromTo(".testimonial_section .section_header", 
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
      .fromTo(".testimonial_section .section_header hr", 
        { scaleX: 0 },
        { scaleX: 1, duration: 0.6 },
        "-=0.3"
      );

    // Animate testimonial cards
    const testimonialCards = document.querySelectorAll('.testimonial_card');
    testimonialCards.forEach((card, index) => {
      testimonialsTimeline.fromTo(card,
        { 
          opacity: 0, 
          y: 50 
        },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.6 
        },
        "-=0.4"
      );
    });

    // Animate controls
    testimonialsTimeline
      .fromTo(".carousel_control",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      );
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Form submission logic here
    console.log('Form submitted');
  };

  return (
    <>
      <Navbar />
      <main>
        <section className="hero_section">
          <div className="container_width">
            <div className="hero_content">
              <div className="hero_left">
                <h1 className="hero_title primaryfont">YOUR ONE STOP SOLUTION</h1>
                <p className="hero_description">
                  Eclipseer aims to provide one stop solution for both people and businesses. Our objective is to make
                  it easy for businesses to gain insights for their solutions and provide a platform to people to earn
                  rewards easily.
                </p>
                <a href="#" className="hero_register">Register <i className="ri-arrow-right-line"></i></a>

                <div className="stats_cards">
                  <div className="stats_card">
                    <div className="card_text">
                      <h3>2000+</h3>
                      <p>Active Users</p>
                    </div>
                    <div className="card_icon">
                      <img src={heroCard1} alt="Users icon" />
                    </div>
                  </div>

                  <div className="stats_card">
                    <div className="card_text">
                      <h3>100+</h3>
                      <p>Available Surveys</p>
                    </div>
                    <div className="card_icon">
                      <img src={heroCard2} alt="Surveys icon" />
                    </div>
                  </div>

                  <div className="stats_card">
                    <div className="card_text">
                      <h3>$10,000+</h3>
                      <p>Rewards Earned</p>
                    </div>
                    <div className="card_icon">
                      <img src={heroCard3} alt="Rewards icon" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="hero_right">
                <div className="hero_image">
                  <img src={HeroRight} alt="Hero" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Updated Why Us Section */}
        <section className="why_us_section">
          <div className="container_width">
            <div className="section_header">
              <h2 className="section_title primaryfont">WHY US?</h2>
              <hr />
            </div>
            <div className="slideshow_container">
              <div className="slideshow_content">
                <div className="slideshow_left">
                  <h3 className="slide_title primaryfont">
                    {whyUsSlides.find(slide => slide.id === activeSlide)?.title}
                  </h3>
                  <div className="slide_indicators">
                    {whyUsSlides.map(slide => (
                      <button
                        key={slide.id}
                        className={`indicator primaryfont ${activeSlide === slide.id ? 'active' : ''}`}
                        data-slide={slide.id}
                        onClick={() => setActiveSlide(slide.id)}
                      >
                        {slide.id}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="slideshow_right">
                  {whyUsSlides.map(slide => (
                    <div
                      key={slide.id}
                      className={`slide_description ${activeSlide === slide.id ? 'active' : ''}`}
                      data-slide={slide.id}
                    >
                      {slide.description.replace(slide.highlightedText, '')}
                      <span className="highlight">{slide.highlightedText}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="slideshow_details">
                <div className="slideshow_details_content">
                  <div className="slideshow_details_left">
                    {whyUsSlides.map(slide => (
                      <div
                        key={slide.id}
                        className={`slide_details_text ${activeSlide === slide.id ? 'active' : ''}`}
                        data-slide={slide.id}
                      >
                        <h3 className="primaryfont">{slide.detailsTitle}</h3>
                        <p>{slide.detailsDesc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="slideshow_details_right">
                    <div className="slideshow_details_assets">
                      {whyUsSlides.map(slide => (
                        <img
                          key={slide.id}
                          src={slide.image}
                          alt={`Why us slide ${slide.id}`}
                          className={`details_assets_img ${activeSlide === slide.id ? 'active' : ''}`}
                          data-slide={slide.id}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="services_section" id="services">
          <div className="container_width">
            <div className="section_header opposite" id="services_section_header">
              <div className="section_header_details">
                <h2 className="section_title primaryfont">SERVICES</h2>
                <div style={{ position: 'relative' }}>
                  <div className="pill_button__container">
                    <div 
                      className="pill_button__pill" 
                      style={{ 
                        transform: serviceView === 'business' 
                          ? 'translateX(0)' 
                          : 'translateX(110%)'
                      }}
                    />
                    <button 
                      className={`pill_button__btn ${serviceView === 'business' ? 'active' : ''}`}
                      onClick={() => setServiceView('business')}
                    >
                      Business
                    </button>
                    <button 
                      className={`pill_button__btn ${serviceView === 'participant' ? 'active' : ''}`}
                      onClick={() => setServiceView('participant')}
                    >
                      Participant
                    </button>
                  </div>
                </div>
              </div>
              <hr />
            </div>

            <div className="business_points">
              <div className="services_point_content right">
                <div className="services_point_image">
                  <div className="services_cards_container">
                    <img src={services11} alt="" className="overlap-img img1" />
                    <img src={services12} alt="" className="overlap-img img2" />
                    <img src={services13} alt="" className="overlap-img img3" />
                  </div>
                </div>

                <div className="services_point_text">
                  <div className="point_number">01</div>
                  <h3 className="point_title">Create <span className="highlight">fully customizable</span> surveys</h3>
                  <p className="point_description">
                    Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra
                    conubia vitae. Nisl ultrices egestas at tellus ultricies mollis malesuada justo justo. Proin
                    urna porttitor hac dui fermentum.
                  </p>
                </div>
              </div>

              {/* Additional service points */}
              {[
                {
                  number: "02",
                  title: "Get useful and user centric insights",
                  highlight: "insights",
                  description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultricies mollis malesuada justo justo. Proin urna porttitor hac dui fermentum.",
                  image: services2
                },
                {
                  number: "03",
                  title: "Take action and see the results",
                  highlight: "results",
                  description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultricies mollis malesuada justo justo. Proin urna porttitor hac dui fermentum.",
                  image: (
                    <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Top Section - Purple */}
                      <div style={{ position: 'relative', width: '100%' }}>
                        <img 
                          src={purpleRect} 
                          alt="Purple background" 
                          style={{ width: '100%', height: 'auto' }}
                        />
                        <img 
                          src={plus30} 
                          alt="30% increase" 
                          style={{ 
                            position: 'absolute', 
                            top: '10%', 
                            left: '5%',
                            width: '25%' 
                          }}
                        />
                        <img 
                          src={increaseText} 
                          alt="Increase text" 
                          style={{ 
                            position: 'absolute', 
                            top: '26%', 
                            left: '7%',
                            width: '40%' 
                          }}
                        />
                        <img 
                          src={graphTrail} 
                          alt="Graph trail" 
                          style={{ 
                            position: 'absolute', 
                            bottom: '10%', 
                            right: '22%',
                            width: '60%' 
                          }}
                        />
                      </div>

                      {/* Bottom Section - Gray */}
                      <div style={{ position: 'relative', width: '100%' }}>
                        <img 
                          src={grayRect} 
                          alt="Gray background" 
                          style={{ width: '100%', height: 'auto' }}
                        />
                        <img 
                          src={amount} 
                          alt="Revenue amount" 
                          style={{ 
                            position: 'absolute', 
                            top: '20%', 
                            left: '50%', 
                            transform: 'translateX(-50%)',
                            width: '40%' 
                          }}
                        />
                        <img 
                          src={revenueText} 
                          alt="Revenue text" 
                          style={{ 
                            position: 'absolute', 
                            bottom: '20%', 
                            left: '50%', 
                            transform: 'translateX(-50%)',
                            width: '60%' 
                          }}
                        />
                      </div>
                    </div>
                  )
                },
                {
                  number: "04",
                  title: "Use the power of AI",
                  highlight: "AI",
                  description: "Lorem ipsum odor amet, consectetuer adipiscing elit. Ultricies condimentum feugiat pharetra conubia vitae. Nisl ultrices egestas at tellus ultricies mollis malesuada justo justo. Proin urna porttitor hac dui fermentum.",
                  image: (
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gridTemplateRows: '1fr 1fr',
                      gap: '0',
                      width: '100%',
                      aspectRatio: '1',
                      maxWidth: '400px',
                      margin: '0 auto',
                      position: 'relative'
                    }}>
                      {[
                        { 
                          img: service41, 
                          text: s41text,
                          bgColor: '#1E1E1E',
                          textContent: 'AI',
                          color: 'white',
                          position: { top: 0, left: 0 }
                        },
                        { 
                          img: service42, 
                          text: s42text,
                          bgColor: '#C358FF',
                          textContent: 'Surveys & Quests',
                          color: 'white',
                          position: { top: 0, right: 0 }
                        },
                        { 
                          img: service43, 
                          text: s43text,
                          bgColor: '#E6E6E6',
                          textContent: 'User',
                          color: 'black',
                          position: { bottom: 0, left: 0 }
                        },
                        { 
                          img: service44, 
                          text: s44text,
                          bgColor: '#9747FF',
                          textContent: 'Business',
                          color: 'white',
                          position: { bottom: 0, right: 0 }
                        }
                      ].map((item, index) => {
                        // Calculate position based on index
                        const top = index < 2 ? "0" : "50%";
                        const left = index % 2 === 0 ? "0" : "50%";
                        
                        return (
                          <div key={index} style={{ 
                            position: 'absolute',
                            top: top,
                            left: left,
                            width: '50%', 
                            height: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            overflow: 'visible'
                          }}>
                            <img 
                              src={item.img} 
                              alt={`Service 4.${index + 1}`} 
                              style={{ 
                                width: '100%',
                                height: '100%',
                                objectFit: 'fill',
                                position: 'absolute',
                                top: 0,
                                left: 0
                              }}
                            />
                            <img 
                              src={item.text} 
                              alt={`Text 4.${index + 1}`} 
                              style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: index === 0 ? '40%' : 
                                       index === 1 ? '60%' : 
                                       index === 2 ? '40%' : '50%',
                                zIndex: 2
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )
                }
              ].map((point, index) => (
                <div key={point.number} className={`services_point_content ${index % 2 === 0 ? 'left' : 'right'}`}>
                  <div className="services_point_image">
                    {typeof point.image === 'string' ? (
                      <img src={point.image} alt={`Service ${point.number}`} style={{width: '100%', height: 'auto'}}/>
                    ) : (
                      point.image
                    )}
                  </div>
                  <div className="services_point_text">
                    <div className="point_number">{point.number}</div>
                    <h3 className="point_title">
                      {point.title.split(point.highlight)[0]}
                      <span className="highlight">{point.highlight}</span>
                      {point.title.split(point.highlight)[1]}
                    </h3>
                    <p className="point_description">{point.description}</p>
                  </div>
                </div>
              ))}

              <div className="services_cards">
                {[
                  {
                    title: "Usability Tests",
                    description: "Evaluate how easily users navigate and interact with your product."
                  },
                  {
                    title: "Interviews",
                    description: "Gather in-depth qualitative insights from your target audience."
                  }
                ].map((card, index) => (
                  <div key={index} className={`service_card ${activeServiceCard === index ? 'active' : ''}`} data-index={index}>
                    <h3 className={activeServiceCard === index ? 'text-white' : 'text-black'}>{card.title}</h3>
                    <p>{card.description}</p>
                    <a href="#" className="learn_more">Learn more <i className="ri-arrow-right-line"></i></a>
                    <div className="progress_container">
                      <div className="progress_bar"></div>
                    </div>
                  </div>
                ))}

                <div className="">
                  <h1 className="services_additional_title primaryfont">Additional Services</h1>
                  <p className="services_additional_description">
                    We can also design custom <strong>methodologies</strong> tailored to your specific needs. With
                    our experienced researchers, there's virtually no challenge we can't tackle.
                  </p>
                </div>

                {[
                  {
                    title: "Focus Groups",
                    description: "Explore group dynamics and shared feedback."
                  },
                  {
                    title: "Playtests (Gaming)",
                    description: "Test gameplay to improve user experience and satisfaction."
                  },
                  {
                    title: "Concept Testing",
                    description: "Assess early ideas or prototypes for market readiness."
                  },
                  {
                    title: "Expert Reviews",
                    description: "An expert evaluates your product for usability and design flaws."
                  },
                  {
                    title: "Surveys",
                    description: "Collect quantitative feedback efficiently."
                  },
                  {
                    title: "Diary Studies",
                    description: "Understand user behavior over time through self-reported data."
                  }
                ].map((card, index) => (
                  <div 
                    key={index + 2} 
                    className={`service_card ${activeServiceCard === index + 2 ? 'active' : ''}`} 
                    data-index={index + 2}
                  >
                    <h3 className={activeServiceCard === index + 2 ? 'text-white' : 'text-black'}>{card.title}</h3>
                    <p>{card.description}</p>
                    <a href="#" className="learn_more">Learn more <i className="ri-arrow-right-line"></i></a>
                    <div className="progress_container">
                      <div className="progress_bar"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="user_points"></div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="contact_section" id="contact">
          <div className="container_width">
            <div className="section_header">
              <h2 className="section_title primaryfont">Contact Us</h2>
              <hr />
            </div>
            <div className="contact_wrapper">
              {/* Pipeline section */}
              <div className="pipeline_section">
                <h2 className="pipeline_title primaryfont">
                  We're dedicated to empowering individuals and businesses alike.
                  Let's explore opportunities together.
                </h2>
                <div className="pipeline_steps">
                  { [
                    {
                      step: 1,
                      title: "Contact Us",
                      description: "Schedule a call to discuss your research needs and objectives."
                    },
                    {
                      step: 2,
                      title: "Conduct Research",
                      description: "We handle all the research, from planning to execution, using the methodology that best fits your goals."
                    },
                    {
                      step: 3,
                      title: "Deliver Insights",
                      description: "Receive actionable insights and recommendations to elevate your business."
                    }
                  ].map((step, index) => (
                    <div
                      key={index}
                      className={`pipeline_step ${activeStep === index ? 'active' : ''}`}
                      data-step={step.step}
                    >
                      <div className="step_number">{step.step}</div>
                      <div className="step_content">
                        <h3 className="primaryfont">{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="contact_form_section">
                <h2 className="primaryfont">Drop Us A Line</h2>
                <form className="contact_form" id="contactForm" onSubmit={handleSubmit}>
                  <div className="form_row">
                    <div className="form_group">
                      <input className="primaryfont" type="text" id="name" name="name" required placeholder="Name*" />
                    </div>
                    <div className="form_group">
                      <input className="primaryfont" type="text" id="lastName" name="lastName" required placeholder="Last Name*" />
                    </div>
                  </div>
                  <div className="form_row">
                    <div className="form_group">
                      <input className="primaryfont" type="email" id="email" name="email" required placeholder="Email Address*" />
                    </div>
                    <div className="form_group">
                      <input className="primaryfont" type="tel" id="phone" name="phone" placeholder="Phone Number" />
                    </div>
                  </div>
                  <div className="form_group">
                    <textarea className="primaryfont" id="message" name="message" required placeholder="Message*"></textarea>
                  </div>
                  <button type="submit" className="button_primary submit_btn primaryfont">SEND</button>
                </form>

                <div className="contact_info">
                  <div className="contact_details">
                    <p className="address primaryfont">This will be an address, should be a little lengthy</p>
                    <a href="tel:+923165165672" className="primaryfont">+92 316 516 5672</a>
                    <a href="mailto:info@eclipseer.com" className="primaryfont">info@eclipseer.com</a>
                  </div>
                  <div className="social_links">
                    <a href="#" className="social_link">Instagram <i className="ri-arrow-right-line"></i></a>
                    <a href="#" className="social_link">Facebook <i className="ri-arrow-right-line"></i></a>
                    <a href="#" className="social_link">LinkedIn <i className="ri-arrow-right-line"></i></a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Videos Section */}
        <section className="videos_section">
          <div className="container_width">
            <div className="section_header">
              <h2 className="section_title primaryfont opposite">VIDEOS</h2>
              <hr />
            </div>
            <div className="videos_list">
              {videos.map((video, index) => (
                <a key={index} className="video_item" href="#">
                  <div className="video_content">
                    <span className="video_index">{video.index}</span>
                    <div>
                      <h3 className="video_title primaryfont">{video.title}</h3>
                      <p>{video.description}</p>
                    </div>
                  </div>
                  <div className="video_thumbnail">
                    <img src={videothumbnail} alt={`Video thumbnail ${index + 1}`} />
                  </div>
                </a>
              ))}
            </div>
            <a href="#" className="more_link">
              More <i className="ri-arrow-right-line"></i>
            </a>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="testimonial_section" id="about">
          <div className="container_width">
            <div className="section_header">
              <h2 className="section_title primaryfont">TESTIMONIALS</h2>
              <hr />
            </div>

            <div className="owl-carousel">
              <div className="testimonials_container">
                {testimonials.map((testimonial, index) => (
                  <div 
                    key={index} 
                    className="testimonial_card"
                    style={{
                      display: index >= currentSlide && index < currentSlide + 2 ? 'flex' : 'none'
                    }}
                  >
                    <div className="testimonial_top">
                      <div className="testimonial_quote">
                        <img src={testimonialQuote} alt="quote" />
                      </div>
                      <div className="testimonial_name primaryfont">{testimonial.name}</div>
                    </div>
                    <div className="testimonial_bottom">
                      <div className="testimonial_image">
                        <img src={testimonial.image} alt={`testimonial ${index + 1}`} />
                      </div>
                      <p>{testimonial.quote}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="carousel_control">
              <div className="carousel_dots">
                {[...Array(totalSlides)].map((_, index) => (
                  <span
                    key={index}
                    className={`custom_dot ${currentSlide === index ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
              <div className="carousel_buttons">
                <button onClick={prevSlide}><i className="ri-arrow-left-line"></i></button>
                <button onClick={nextSlide}><i className="ri-arrow-right-line"></i></button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default Home;
