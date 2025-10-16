import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import Navbar from '../Navigation/Navbar';
import Footer from '../Navigation/Footer';
import eclipseerlogo from './eclipseer-logo.png';
import '../static/css/account.css';
import accountBg from '../static/assets/account_bg.png';
import googleimage from '../static/assets/google_icon.png';
import { authAPI, seasonPassAPI, SeasonPassTierManager } from 'services/apiClient';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const leftContentRef = useRef(null);
  const formContainerRef = useRef(null);

  useEffect(() => {
    let currentIndex = 1;
    const interval = setInterval(() => {
      currentIndex = (currentIndex % 3) + 1;
      showContent(currentIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // GSAP animation setup
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Set initial states - both elements start off-screen
    gsap.set(leftContentRef.current, { x: "-100%", opacity: 0 });
    gsap.set(formContainerRef.current, { x: "100%", opacity: 0 });

    // Animation sequence
    tl.to(leftContentRef.current, {
      x: 0,
      opacity: 1,
      duration: 1.2,
      ease: "power2.out"
    })
    .to(formContainerRef.current, {
      x: 0,
      opacity: 1,
      duration: 1,
      ease: "power2.out"
    }, "-=0.8"); // Start before first animation finishes for overlap

    // Cleanup function
    return () => {
      tl.kill();
    };
  }, []);

  const showContent = (index) => {
    document.querySelectorAll('.eclipseer_unique_tab_button').forEach(button => 
      button.classList.remove('eclipseer_active')
    );
    document.querySelectorAll('.eclipseer_unique_tab_button')[index - 1].classList.add('eclipseer_active');
    
    document.querySelectorAll('.eclipseer_unique_content_item').forEach(item => 
      item.classList.remove('eclipseer_active')
    );
    document.getElementById(`eclipseer_content_${index}`).classList.add('eclipseer_active');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();

    if (!mfaCode) {
      setError('Please enter the verification code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.verifyMfaLogin({
        email: userEmail,
        pin: mfaCode,
      });

      const data = response.data;

      // --- Store token and user info ---
      localStorage.setItem('token', data.token); 
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userRole', data.role);

      console.log('MFA Login successful:', data);

      // Fetch Season Pass data for regular users
      if (data.role !== 'super_admin' && data.role !== 'admin' && data.role !== 'business_admin') {
        await fetchSeasonPassData();
      }

      // --- Navigate based on role (Super admins ALWAYS go to admin dashboard) ---
      if (data.role === 'super_admin' || data.role === 'admin') {
        console.log('[LOGIN_DEBUG] Super admin detected - always navigating to admin dashboard');
        try {
          navigate('/admin'); // Super admins ALWAYS go to the main admin dashboard
          console.log('[LOGIN_DEBUG] Navigation to /admin called successfully');
        } catch (navError) {
          console.error('[LOGIN_DEBUG] Error during navigation to /admin:', navError);
        }
      } else if (data.role === 'business_admin') {
        // Business admin should go to their specific business dashboard
        // The business_id should be part of data.user from the login response
        const businessId = data.user?.business_id;
        console.log('[LOGIN_DEBUG] Business admin detected - business_id:', businessId);
        if (businessId) {
            console.log('[LOGIN_DEBUG] Navigating to business admin dashboard');
            try {
              navigate(`/business-admin/dashboard`); // Business admin dashboard with context
              console.log('[LOGIN_DEBUG] Navigation to /business-admin/dashboard called successfully');
            } catch (navError) {
              console.error('[LOGIN_DEBUG] Error during navigation to business admin:', navError);
            }
        } else {
            // Fallback or error: BA not associated with a business
            console.log('[LOGIN_DEBUG] ERROR: Business admin not associated with any business');
            setError("Business Admin not associated with a business. Contact support.");
            localStorage.clear(); // Clear auth state
            return; // Don't proceed with navigation
        }
      } else {
        navigate('/user/home'); // Regular users go to user home
      }

    } catch (err) {
       console.error("MFA Verification Error:", err);
       let specificError = 'Verification failed. Please try again.';
       if (err.response && err.response.data && err.response.data.error) {
          specificError = err.response.data.error;
       } else if (err.message) {
          specificError = err.message;
       }
       setError(specificError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setMfaCode('');
    setUserEmail('');
    setError('');
  };

  // Helper function to fetch and store Season Pass data after login
  const fetchSeasonPassData = async () => {
    try {
      console.log('[LOGIN_DEBUG] Fetching Season Pass data...');
      const response = await seasonPassAPI.getState();
      
      // Update SeasonPassTierManager with the response
      SeasonPassTierManager.updateFromAPIResponse(response);
      
      console.log('[LOGIN_DEBUG] Season Pass data loaded successfully');
    } catch (error) {
      console.error('[LOGIN_DEBUG] Error fetching Season Pass data:', error);
      // Don't block login if Season Pass fetch fails
      SeasonPassTierManager.clearTier();
    }
  };

  const handleGoogleLogin = () => {
    // Redirects to the backend endpoint that starts the Google OAuth flow.
    window.location.href = '/api/google_auth/linking/google/initiate';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    console.log('[LOGIN_DEBUG] === Starting login process ===');
    console.log('[LOGIN_DEBUG] Username:', username);
    console.log('[LOGIN_DEBUG] Password length:', password.length);

    try {
      // Pass credentials as an object
      const loginData = {
         username: username,
         password: password,
      };
      
      console.log('[LOGIN_DEBUG] Sending login request with data:', loginData);
      
      const response = await authAPI.login(loginData);
      
      console.log('[LOGIN_DEBUG] Raw response received:', response);
      console.log('[LOGIN_DEBUG] Response status:', response.status);
      console.log('[LOGIN_DEBUG] Response headers:', response.headers);

      const data = response.data; // Correctly access Axios response data
      
      console.log('[LOGIN_DEBUG] Response data:', data);
      console.log('[LOGIN_DEBUG] Data keys:', Object.keys(data));

      if (data.registration_incomplete) {
        console.log('[LOGIN_DEBUG] Registration incomplete detected');
        console.log('[LOGIN_DEBUG] Next step:', data.next_step);
        console.log('[LOGIN_DEBUG] Temp auth token:', data.tempAuthToken);
        
        // Clear any existing auth data to prevent conflicts
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        
        // Set registration session data
        localStorage.setItem('reg_temp_auth_token', data.tempAuthToken);
        localStorage.setItem('reg_user_email', data.email);
        
        // **FIXED: Correctly navigate based on the next_step from the backend**
        const nextStep = data.next_step;
        switch (nextStep) {
          case 'verify_email':
            console.log('[LOGIN_DEBUG] Redirecting to email verification page');
            navigate('/verify-email');
            break;
          case 'profile':
            console.log('[LOGIN_DEBUG] Redirecting to signup step 2 for profile completion');
            navigate('/register/step2');
            break;
          case 'complete':
            console.log('[LOGIN_DEBUG] Registration already complete, redirecting to user home');
            navigate('/user/home');
            break;
          default:
            console.log(`[LOGIN_DEBUG] Unknown next_step '${nextStep}', defaulting to step 2.`);
            navigate('/register/step2');
            break;
        }
        return; // Stop further execution
      }

      // Check if MFA is required
      if (data.mfa_required) {
        console.log('[LOGIN_DEBUG] MFA required for login');
        console.log('[LOGIN_DEBUG] User email for MFA:', data.email);
        setMfaRequired(true);
        setUserEmail(data.email);
        setError(''); // Clear any previous errors
        return; // Don't proceed with login, wait for MFA
      }

      console.log('[LOGIN_DEBUG] Normal login success - storing auth data');
      console.log('[LOGIN_DEBUG] Token:', data.token ? `${data.token.substring(0, 20)}...` : 'NO TOKEN');
      console.log('[LOGIN_DEBUG] User data:', data.user);
      console.log('[LOGIN_DEBUG] Role:', data.role);

      // --- Store token and user info ---
      localStorage.setItem('token', data.token); 
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('userRole', data.role);

      console.log('[LOGIN_DEBUG] Auth data stored in localStorage');
      console.log('[LOGIN_DEBUG] Stored token:', localStorage.getItem('token') ? 'PRESENT' : 'MISSING');
      console.log('[LOGIN_DEBUG] Stored user:', localStorage.getItem('user') ? 'PRESENT' : 'MISSING');
      console.log('[LOGIN_DEBUG] Stored role:', localStorage.getItem('userRole'));

      console.log('Login successful:', data);

      // Fetch Season Pass data for regular users
      if (data.role !== 'super_admin' && data.role !== 'admin' && data.role !== 'business_admin') {
        await fetchSeasonPassData();
      }

      // --- Navigate based on role (Super admins ALWAYS go to admin dashboard) ---
      console.log('[LOGIN_DEBUG] Determining navigation based on role:', data.role);
      
      if (data.role === 'super_admin' || data.role === 'admin') { // Handle both super_admin and legacy admin
        console.log('[LOGIN_DEBUG] Super admin detected - always navigating to admin dashboard');
        try {
          navigate('/admin'); // Super admins ALWAYS go to the main admin dashboard
          console.log('[LOGIN_DEBUG] Navigation to /admin called successfully');
        } catch (navError) {
          console.error('[LOGIN_DEBUG] Error during navigation to /admin:', navError);
        }
      } else if (data.role === 'business_admin') {
        // Business admin should go to their specific business dashboard
        // The business_id should be part of data.user from the login response
        const businessId = data.user?.business_id;
        console.log('[LOGIN_DEBUG] Business admin detected - business_id:', businessId);
        if (businessId) {
            console.log('[LOGIN_DEBUG] Navigating to business admin dashboard');
            try {
              navigate(`/business-admin/dashboard`); // Business admin dashboard with context
              console.log('[LOGIN_DEBUG] Navigation to /business-admin/dashboard called successfully');
            } catch (navError) {
              console.error('[LOGIN_DEBUG] Error during navigation to business admin:', navError);
            }
        } else {
            // Fallback or error: BA not associated with a business
            console.log('[LOGIN_DEBUG] ERROR: Business admin not associated with any business');
            setError("Business Admin not associated with a business. Contact support.");
            localStorage.clear(); // Clear auth state
            return; // Don't proceed with navigation
        }
      } else {
        // For regular users, redirect to user dashboard
        console.log('[LOGIN_DEBUG] Regular user - navigating to user dashboard');
        try {
          navigate('/user/home'); // Regular users go to user home
          console.log('[LOGIN_DEBUG] Navigation to /user/home called successfully');
        } catch (navError) {
          console.error('[LOGIN_DEBUG] Error during navigation to user dashboard:', navError);
        }
      }

      console.log('[LOGIN_DEBUG] === Login process completed ===');

    } catch (err) {
       // --- Improved Error Handling ---
       console.error('[LOGIN_DEBUG] === ERROR during login ===');
       console.error('[LOGIN_DEBUG] Full error object:', err);
       console.error('[LOGIN_DEBUG] Error message:', err.message);
       console.error('[LOGIN_DEBUG] Error response:', err.response);
       console.error('[LOGIN_DEBUG] Error response data:', err.response?.data);
       console.error('[LOGIN_DEBUG] Error response status:', err.response?.status);
       console.error('[LOGIN_DEBUG] Error config:', err.config);
       
       console.error("Login Error Full Details:", err); // Log the full error object
       let specificError = 'Sign In failed. Please try again.';
       if (err.response && err.response.data && err.response.data.error) {
          // Use the error message from the backend response if available
          specificError = err.response.data.error;
          console.log('[LOGIN_DEBUG] Using backend error message:', specificError);
       } else if (err.message) {
          // Fallback to the Axios error message
          specificError = err.message;
          console.log('[LOGIN_DEBUG] Using axios error message:', specificError);
       }
       
       console.log('[LOGIN_DEBUG] Final error message to display:', specificError);
       setError(specificError); // Display the more specific error
    } finally {
      console.log('[LOGIN_DEBUG] Setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <div className="account_page">
      <Navbar />
      <div className="main_container container_width">
        <div className="extra_info" ref={leftContentRef}>
          <img src={accountBg} alt="background" />
          <div className="extra_info_content">
            <div className="extra_info_one">
              <img src={eclipseerlogo} alt="eclipseer logo" />
              <h3 className="primaryfont">Welcome Back</h3>
              <p>Eclipseer bridges the gap between businesses seeking actionable insights and 
                 participants looking to earn rewards. With cutting-edge AI, we make the process 
                 seamless, impactful, and <span className="highlighted">rewarding for all parties.</span>
              </p>
            </div>
            
            <div className="extra_info_two">
              <img src={eclipseerlogo} alt="eclipseer logo" />
              <h3 className="primaryfont">Why Us?</h3>
              <div className="eclipseer_unique_button_container">
                {[1, 2, 3].map(num => (
                  <button 
                    key={num}
                    className={`primaryfont eclipseer_unique_tab_button ${num === 1 ? 'eclipseer_active' : ''}`}
                    onClick={() => showContent(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="eclipseer_unique_content_section">
                <div id="eclipseer_content_1" className="eclipseer_unique_content_item eclipseer_active">
                  Eclipseer bridges the gap between businesses seeking actionable insights and participants looking to earn rewards.
                </div>
                <div id="eclipseer_content_2" className="eclipseer_unique_content_item">
                  With cutting-edge AI, we make the process seamless and impactful.
                </div>
                <div id="eclipseer_content_3" className="eclipseer_unique_content_item">
                  Rewarding for all parties involved with meaningful participation.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form_container" ref={formContainerRef} style={{ color: 'white', marginTop: '-5rem' }}>
          <h2 className="form_heading primaryfont" style={{ marginBottom: '2rem' }}>
            {mfaRequired ? 'Enter Verification Code' : 'Sign In'}
          </h2>
          {error && <div id="login_message">{error}</div>}
          
          {mfaRequired ? (
            <form id="mfaForm" onSubmit={handleMfaSubmit}>
              <p style={{ marginBottom: '1rem', color: '#ccc' }}>
                We've sent a verification code to {userEmail}. Please check your email and enter the code below.
              </p>
              
              <div className="input_container">
                <input
                  className="primaryfont"
                  type="text"
                  id="mfaCode"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="Enter 6-digit code*"
                  maxLength={6}
                  required
                />
              </div>

              <button type="submit" className="form_button_type_2 primaryfont" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </button>

              <button type="button" onClick={handleBackToLogin} className="form_button_type_1 primaryfont" style={{ marginTop: '1rem' }}>
                Back to Login
              </button>
            </form>
          ) : (
            <form id="loginForm" onSubmit={handleSubmit}>
            <div className="input_container">
              <input
                className="primaryfont"
                type="text"
                id="loginEmail"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or Email*"
                required
              />
            </div>

            <div className="password_container">
              <div>
                <input
                  className="primaryfont"
                  type={showPassword ? 'text' : 'password'}
                  id="loginPassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password*"
                  required
                />
                <button type="button" onClick={togglePasswordVisibility}>
                  <i className={`ri-eye${showPassword ? '-off' : ''}-fill ri-xl`}></i>
                </button>
              </div>
            </div>

            <div className="multi_option_container">
              <div className="remember_me_contanier">
                <input
                  type="checkbox"
                  id="loginRememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember Me</span>
              </div>
              <div className="form_button_type_1">
                <button type="button" onClick={() => navigate('/forgot-password')}>
                  Forgot Password?
                </button>
              </div>
            </div>

            <button type="submit" className="form_button_type_2 primaryfont" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="question_line">
              Don't have an account? <span onClick={() => navigate('/signup')}>Sign Up</span>
            </p>

            <div className="divider">
              <hr />
              <p className="primaryfont">OR</p>
              <hr />
            </div>

            <button type="button" className="googleAuthBtn" onClick={handleGoogleLogin}>
              <img src={googleimage} alt="google_icon" />
              <p className="primaryfont">Sign In with Google</p>
            </button>
          </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Login;