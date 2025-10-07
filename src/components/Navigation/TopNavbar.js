import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import eclipseerLogo from '../eclipseer-logo1.png';
import { userProfileAPI, notificationAPI, baseURL } from '../../services/apiClient';
import toast from 'react-hot-toast';
import '../../styles/TopNavbar.css';
import UserProfileOverview from '../user/UserProfileOverview';
import UserEditProfile from '../user/UserEditProfile';
import UserEditTags from '../user/UserEditTags';
import UserBadges from '../user/UserBadges';
import UserRewardsHistory from '../user/UserRewardsHistory';
import UserReferrals from '../user/UserReferrals';

const TopNavbar = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [highestBadge, setHighestBadge] = useState(null);
    const [notificationCount, setNotificationCount] = useState(0);
    const [xpBalance, setXpBalance] = useState(0);

    // Ref to XP element for animation
    const xpRef = useRef(null);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
    const [isProfileOverlayOpen, setIsProfileOverlayOpen] = useState(false);
    const [overlayView, setOverlayView] = useState('overview'); // 'overview' | 'edit-profile' | 'tags' | 'badges' | 'rewards' | 'referrals'
    const userMenuRef = useRef(null);
    const hamburgerRef = useRef(null);
    const overlayRef = useRef(null);

    useEffect(() => {
        const loadUser = () => {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                    setXpBalance(parsedUser.xp_balance || 0);
                } catch (error) {
                    console.error('Error parsing user data:', error);
                }
            }
        };

        // Load user data on mount
        loadUser();

        // Listen for XP gained events
        const handleXPGained = (e) => {
            const { newBalance } = e.detail;
            setXpBalance(newBalance);
            
            // Update user in localStorage
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const parsedUser = JSON.parse(userData);
                    parsedUser.xp_balance = newBalance;
                    localStorage.setItem('user', JSON.stringify(parsedUser));
                    setUser(parsedUser);
                } catch (error) {
                    console.error('Error updating user data:', error);
                }
            }
        };

        // Listen for profile updates (including profile picture changes)
        const handleProfileUpdate = (e) => {
            // If event has user data, use it directly for immediate update
            if (e.detail && e.detail.user) {
                const updatedUser = e.detail.user;
                setUser(updatedUser);
                setXpBalance(updatedUser.xp_balance || 0);
                // Update localStorage with the fresh data
                localStorage.setItem('user', JSON.stringify(updatedUser));
            } else {
                // Fallback: refresh user data from localStorage
                loadUser();
            }
        };

        // Add event listeners
        document.addEventListener('xp-gained', handleXPGained);
        document.addEventListener('profile-updated', handleProfileUpdate);

        // Cleanup function
        const removeListener = () => {
            document.removeEventListener('xp-gained', handleXPGained);
            document.removeEventListener('profile-updated', handleProfileUpdate);
        };

        return removeListener;
    }, []);

    // Handle global XP gained events for dopamine feedback 🎉
    useEffect(() => {
        const handleXPGained = (e) => {
            const amount = e.detail?.amount ? Number(e.detail.amount) : 0;
            if (amount <= 0) return;

            // Increment local balance immediately for responsiveness
            setXpBalance(prev => prev + amount);

            // Play sound effect (fallback to simple beep if asset missing)
            try {
                const audio = new Audio('/xp-gain.mp3'); // Place your coin sound in public/xp-gain.mp3
                audio.volume = 0.4;
                audio.play().catch(() => {/* silent failure */});
            } catch (err) {
                console.warn('[TOPNAV] Audio play failed:', err);
            }

            // Trigger glow/scale animation
            if (xpRef.current) {
                xpRef.current.classList.add('xp-animate');
                // Remove class after animation ends to allow re-triggering
                const removeListener = () => {
                    xpRef.current && xpRef.current.classList.remove('xp-animate');
                    xpRef.current && xpRef.current.removeEventListener('animationend', removeListener);
                };
                xpRef.current.addEventListener('animationend', removeListener);
            }
        };

        window.addEventListener('xpGained', handleXPGained);
        return () => window.removeEventListener('xpGained', handleXPGained);
    }, []);

    useEffect(() => {
        const fetchHighestBadge = async () => {
            try {
                const response = await userProfileAPI.getMyBadges();
                const badges = response.data?.badges || [];
                
                // Find the badge with the highest XP threshold
                const sortedBadges = badges.sort((a, b) => (b.badge?.xp_threshold || 0) - (a.badge?.xp_threshold || 0));
                if (sortedBadges.length > 0) {
                    setHighestBadge(sortedBadges[0].badge);
                }
            } catch (error) {
                console.error('Error fetching badges:', error);
            }
        };

        const fetchNotificationSummary = async () => {
            try {
                const response = await notificationAPI.getNotificationSummary();
                const unread =
                    response.data?.unread_count ??
                    response.data?.unread_notifications ??
                    0;
                setNotificationCount(unread);
            } catch (error) {
                console.error('Error fetching notification summary:', error);
            }
        };

        if (user) {
            fetchHighestBadge();
            fetchNotificationSummary();
            
            // Set up interval to refresh notification count every 30 seconds
            const notificationInterval = setInterval(fetchNotificationSummary, 30000);
            
            return () => {
                clearInterval(notificationInterval);
            };
        }
    }, [user]);

    // Listen for notification updates (when user marks notifications as read)
    useEffect(() => {
        const fetchNotificationSummary = async () => {
            try {
                const response = await notificationAPI.getNotificationSummary();
                const unread =
                    response.data?.unread_count ??
                    response.data?.unread_notifications ??
                    0;
                setNotificationCount(unread);
            } catch (error) {
                console.error('Error fetching notification summary:', error);
            }
        };

        const handleNotificationUpdate = () => {
            if (user) {
                fetchNotificationSummary();
            }
        };
        
        window.addEventListener('notificationUpdated', handleNotificationUpdate);
        window.addEventListener('focus', handleNotificationUpdate);
        
        return () => {
            window.removeEventListener('notificationUpdated', handleNotificationUpdate);
            window.removeEventListener('focus', handleNotificationUpdate);
        };
    }, [user]);

    const refreshUserData = async () => {
        try {
            console.log('[TOPNAV_DEBUG] Refreshing user data...');
            const response = await userProfileAPI.getUserProfile();
            if (response.data && response.data.user) {
                const updatedUser = response.data.user;
                console.log('[TOPNAV_DEBUG] Fresh user data received:', updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setUser(updatedUser);
                // Trigger event for other components
                window.dispatchEvent(new CustomEvent('userUpdated'));
            }
        } catch (error) {
            console.error('[TOPNAV_DEBUG] Error refreshing user data:', error);
        }
    };

    const handleNotificationClick = () => {
        navigate('/user/notifications');
        setShowNotificationDropdown(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showNotificationDropdown && !event.target.closest('.top-navbar-notifications')) {
                setShowNotificationDropdown(false);
            }
            if (isUserMenuOpen && userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
            if (isHamburgerOpen && hamburgerRef.current && !hamburgerRef.current.contains(event.target)) {
                setIsHamburgerOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showNotificationDropdown, isUserMenuOpen, isHamburgerOpen]);

    // Manage body scroll lock and Escape key when profile overlay is open
    useEffect(() => {
        if (!isProfileOverlayOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsProfileOverlayOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isProfileOverlayOpen]);

    const getFullImageUrl = (relativeOrAbsoluteUrl) => {
        if (!relativeOrAbsoluteUrl) {
            // Return a default SVG badge image as data URL
            return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNGRkQ3MDAiLz4KPHN0YXIgY3g9IjQwIiBjeT0iNDAiIHI9IjIwIiBmaWxsPSIjRkZGRkZGIi8+Cjx0ZXh0IHg9IjQwIiB5PSI0NSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjRkZGRkZGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7wn4+FPC90ZXh0Pgo8L3N2Zz4K";
        }
        // Handle full URLs
        if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
            return relativeOrAbsoluteUrl;
        }
        // Handle relative URLs - ensure they start with /
        const cleanPath = relativeOrAbsoluteUrl.startsWith('/') ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
        return `${baseURL}${cleanPath}`;
    };

    const handleLogout = () => {
        // CRITICAL FIX FOR REGISTRATION TOKEN BUG:
        // Clear ALL session/authentication data from localStorage.
        // This prevents leftover registration tokens (like reg_temp_auth_token)
        // from interfering with subsequent user flows.
        // Previously, selective removal left registration data which caused
        // users to be redirected to registration steps after logout.
        localStorage.clear();

        // Give user feedback
        toast.success("You have been successfully logged out.");

        // Navigate to the login page to start fresh.
        navigate('/login');
    };

    const userNavigationItems = [
        { path: '/user/home', label: 'Home' },
        { path: '/user/brands', label: 'Brands' },
        { path: '/user/surveys', label: 'Surveys' },
        { path: '/user/quests', label: 'Quests' },
        { path: '/user/marketplace', label: 'XP Store' },
        { path: '/user/leaderboard', label: 'Leaderboard' },
    ];

    // Only compute full URL when an image exists to allow proper fallback icon rendering
    const rawProfileImage = user?.profile_image_url;
    const profilePicture = rawProfileImage ? getFullImageUrl(rawProfileImage) : null;

    const toggleUserMenu = () => setIsUserMenuOpen((prev) => !prev);
    const toggleHamburger = () => setIsHamburgerOpen((prev) => !prev);

    const openProfileOverlay = (e) => {
        if (e) e.preventDefault();
        // Only use overlay on desktop/tablet; keep dropdown flow on small screens
        if (window.innerWidth < 769) {
            // For small screens go to Profile Overview
            navigate('/user/profile');
            return;
        }
        setOverlayView('overview');
        setIsProfileOverlayOpen(true);
    };

    const closeProfileOverlay = () => {
        setIsProfileOverlayOpen(false);
    };

    return (
        <>
        <nav className="top-navbar">
            <div className="top-navbar-left">
                <img src={eclipseerLogo} alt="Eclipseer" className="top-navbar-logo" onClick={() => navigate('/user/home')} />
                <div className="top-navbar-links desktop-only">
                    {userNavigationItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `top-navbar-link ${isActive ? 'active' : ''}`}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className="top-navbar-right">
                {highestBadge && (
                    <div className="top-navbar-badge">
                        {highestBadge.image_url ? (
                            <img 
                                src={getFullImageUrl(highestBadge.image_url)} 
                                alt={highestBadge.name}
                                className="top-navbar-badge-icon"
                                onError={(e) => { 
                                    e.target.src = getFullImageUrl(null); // Use default badge image on error
                                }}
                            />
                        ) : (
                            <div className="top-navbar-badge-fallback">
                                {highestBadge.name ? highestBadge.name.substring(0, 2).toUpperCase() : 'B'}
                            </div>
                        )}
                        <span>{highestBadge.name}</span>
                    </div>
                )}
                {/* Notification Bell (visible on all sizes) */}
                <div className="top-navbar-notifications">
                    <button 
                        className="top-navbar-notification-bell"
                        onClick={handleNotificationClick}
                        title="View Notifications"
                    >
                        <i className="ri-notification-3-line"></i>
                        {notificationCount > 0 && (
                            <span className="top-navbar-notification-badge">
                                {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                        )}
                    </button>
                </div>

                <div ref={xpRef} className="top-navbar-xp">
                    ✨ {xpBalance.toLocaleString()} XP
                </div>
                {/* Desktop: profile link opens profile overlay + logout */}
                <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div className="top-navbar-user-menu">
                        <a 
                            href="#"
                            onClick={openProfileOverlay}
                            className="top-navbar-profile"
                            title="Open Profile"
                        >
                            {profilePicture ? (
                                <img 
                                    src={profilePicture} 
                                    alt="Profile" 
                                    className="top-navbar-avatar"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                    }}
                                />
                            ) : (
                                <div className="top-navbar-avatar-fallback"><i className="ri-user-3-line"></i></div>
                            )}
                            <span>{user?.name || user?.username || 'User'}</span>
                        </a>
                        <button onClick={handleLogout} className="top-navbar-logout">Logout</button>
                    </div>
                </div>

                {/* Mobile: user dropdown on right (keep icon look unchanged) */}
                <div ref={userMenuRef} className="top-navbar-mobile-user mobile-only">
                    <button className="user-trigger" onClick={toggleUserMenu} aria-expanded={isUserMenuOpen} aria-haspopup="true">
                        {profilePicture ? (
                            <img
                                src={profilePicture}
                                alt="Profile"
                                className="top-navbar-avatar"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const next = e.currentTarget.nextSibling;
                                    if (next) next.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div className="top-navbar-avatar-fallback" style={{ display: profilePicture ? 'none' : 'flex' }}>
                            <i className="ri-user-3-line"></i>
                        </div>
                    </button>
                    {isUserMenuOpen && (
                        <div className="user-menu-dropdown user-menu-right" role="menu">
                            <div className="user-menu-header">
                                <div className="user-menu-profile">
                                    {profilePicture ? (
                                        <img src={profilePicture} alt="Profile" className="avatar-lg" />
                                    ) : (
                                        <div className="avatar-lg fallback">{user?.name ? user.name[0].toUpperCase() : 'U'}</div>
                                    )}
                                    <span className="user-menu-name">{user?.name || user?.username || 'User'}</span>
                                </div>
                            </div>
                            <div className="user-menu-actions">
                                <button className="profile-link-btn" onClick={() => { navigate('/user/profile'); setIsUserMenuOpen(false); }}>
                                    Profile
                                </button>
                                <button className="logout-btn" onClick={() => { setIsUserMenuOpen(false); handleLogout(); }}>Logout</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile: hamburger menu on far right */}
                <div ref={hamburgerRef} className="top-navbar-mobile-right mobile-only">
                    <button className="hamburger-button" onClick={toggleHamburger} aria-expanded={isHamburgerOpen} aria-haspopup="true" title="Menu">
                        <i className="ri-menu-3-line"></i>
                    </button>
                    {isHamburgerOpen && (
                        <div className="mobile-menu-dropdown" role="menu">
                            {userNavigationItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setIsHamburgerOpen(false)}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </nav>

        {isProfileOverlayOpen && (
            <>
                <div className="profile-overlay-backdrop" onClick={closeProfileOverlay} />
                <div ref={overlayRef} className="profile-overlay-container" role="dialog" aria-modal="true">
                    {overlayView !== 'overview' && (
                        <button className="profile-overlay-back" aria-label="Back" onClick={() => setOverlayView('overview')}>
                            <i className="ri-arrow-left-line"></i>
                        </button>
                    )}
                    <button className="profile-overlay-close" aria-label="Close" onClick={closeProfileOverlay}>
                        <i className="ri-close-line"></i>
                    </button>
                    <div className="profile-overlay-content">
                        {overlayView === 'overview' && (
                            <UserProfileOverview 
                                onClose={closeProfileOverlay}
                                onNavigateOverlay={(view) => setOverlayView(view)}
                            />
                        )}
                        {overlayView === 'edit-profile' && (
                            <UserEditProfile />
                        )}
                        {overlayView === 'tags' && (
                            <UserEditTags />
                        )}
                        {overlayView === 'badges' && (
                            <UserBadges />
                        )}
                        {overlayView === 'rewards' && (
                            <UserRewardsHistory />
                        )}
                        {overlayView === 'referrals' && (
                            <UserReferrals />
                        )}
                    </div>
                </div>
            </>
        )}
        </>
    );
};

export default TopNavbar; 