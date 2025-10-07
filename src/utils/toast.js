import { toast as hotToast } from 'react-hot-toast';

/**
 * Theme-aware toast wrapper
 * Shows dark toasts for user screens and light toasts for admin screens
 */

// Detect current page type based on URL
const getCurrentPageType = () => {
  const path = window.location.pathname;
  
  // Admin pages
  if (path.startsWith('/admin') || path.startsWith('/business-admin')) {
    return 'admin';
  }
  
  // User pages (dashboard, surveys, responses, etc.)
  if (path.startsWith('/user') || 
      path.startsWith('/surveys') || 
      path.startsWith('/response') ||
      path.startsWith('/business/') ||
      path.startsWith('/brand/') ||
      path.startsWith('/marketplace') ||
      path.startsWith('/quests')) {
    return 'user';
  }
  
  // Default to light theme for other pages
  return 'default';
};

// Dark theme styles for user pages
const darkThemeStyles = {
  background: '#1a1a1a',
  color: '#ffffff',
  border: '1px solid #333',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
};

// Light theme styles for admin pages
const lightThemeStyles = {
  background: '#ffffff',
  color: '#1a1a1a',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
};

// Success styles
const successDark = {
  ...darkThemeStyles,
  background: '#0f4c3c',
  border: '1px solid #16a085',
  color: '#a8f5e8',
};

const successLight = {
  ...lightThemeStyles,
  background: '#e8f8f5',
  border: '1px solid #16a085',
  color: '#0f4c3c',
};

// Error styles
const errorDark = {
  ...darkThemeStyles,
  background: '#4c1f1f',
  border: '1px solid #e74c3c',
  color: '#f5a8a8',
};

const errorLight = {
  ...lightThemeStyles,
  background: '#fdf2f2',
  border: '1px solid #e74c3c',
  color: '#4c1f1f',
};

// Loading styles
const loadingDark = {
  ...darkThemeStyles,
  background: '#2c3e50',
  border: '1px solid #3498db',
  color: '#a8d5f5',
};

const loadingLight = {
  ...lightThemeStyles,
  background: '#f0f8ff',
  border: '1px solid #3498db',
  color: '#2c3e50',
};

const getThemeStyles = (type, variant) => {
  const pageType = getCurrentPageType();
  const isDark = pageType === 'user';
  
  switch (variant) {
    case 'success':
      return isDark ? successDark : successLight;
    case 'error':
      return isDark ? errorDark : errorLight;
    case 'loading':
      return isDark ? loadingDark : loadingLight;
    default:
      return isDark ? darkThemeStyles : lightThemeStyles;
  }
};

// Custom toast wrapper
const toast = {
  success: (message, options = {}) => {
    return hotToast.success(message, {
      style: getThemeStyles('user', 'success'),
      duration: 4000,
      ...options,
    });
  },

  error: (message, options = {}) => {
    return hotToast.error(message, {
      style: getThemeStyles('user', 'error'),
      duration: 5000,
      ...options,
    });
  },

  loading: (message, options = {}) => {
    return hotToast.loading(message, {
      style: getThemeStyles('user', 'loading'),
      ...options,
    });
  },

  custom: (message, options = {}) => {
    return hotToast(message, {
      style: getThemeStyles('user', 'default'),
      duration: 4000,
      ...options,
    });
  },

  // Promise-based toast
  promise: (promise, msgs, options = {}) => {
    const pageType = getCurrentPageType();
    const isDark = pageType === 'user';
    
    return hotToast.promise(promise, msgs, {
      style: isDark ? darkThemeStyles : lightThemeStyles,
      success: {
        style: getThemeStyles('user', 'success'),
        duration: 4000,
      },
      error: {
        style: getThemeStyles('user', 'error'),
        duration: 5000,
      },
      loading: {
        style: getThemeStyles('user', 'loading'),
      },
      ...options,
    });
  },

  // Manual dismiss
  dismiss: (toastId) => {
    return hotToast.dismiss(toastId);
  },

  // Remove all toasts
  remove: () => {
    return hotToast.remove();
  },
};

export default toast; 