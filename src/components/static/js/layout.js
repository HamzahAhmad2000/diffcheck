import gsap from 'gsap';

// Initialize any global GSAP configurations here if needed
gsap.config({
  nullTargetWarn: false,
});

// Export any utility functions that might be needed by other components
export const initializeGSAP = () => {
  // Add any global GSAP initialization here
};

// Select the custom cursor element
const cursor = document.createElement('div');
cursor.classList.add('cursor');
document.body.appendChild(cursor);

// Variables for cursor position
let cursorX = 0, cursorY = 0;

// Update cursor position based on mouse movement
function updateCursorPosition(e) {
    cursorX = e.clientX;
    cursorY = e.clientY;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
}

// Set cursor state for pointer (when hovering over clickable elements like buttons, links, or inputs)
function setPointerState() {
    cursor.classList.add('pointer');
}

// Remove pointer state when not hovering over clickable elements
function removePointerState() {
    cursor.classList.remove('pointer');
}

// Set cursor state for focused (when focusing on inputs or text fields)
function setFocusedState() {
    cursor.classList.add('focused');
}

// Remove focused state
function removeFocusedState() {
    cursor.classList.remove('focused');
}

// Mouse event listeners
document.addEventListener('mousemove', updateCursorPosition);
document.addEventListener('mousedown', setPointerState);
document.addEventListener('mouseup', removePointerState);

// Event listener for buttons, links, and input fields
const interactiveElements = document.querySelectorAll('button, a, input, textarea, select');

interactiveElements.forEach(element => {
    element.addEventListener('mouseenter', () => {
        gsap.to(cursor, {
            scale: 1.5,
            duration: 0.2
        });
        setPointerState(); // Change cursor style to pointer
    });

    element.addEventListener('mouseleave', () => {
        gsap.to(cursor, {
            scale: 1,
            duration: 0.2
        });
        removePointerState(); // Reset cursor style
    });

    element.addEventListener('focus', () => {
        setFocusedState(); // Add focused state for inputs
    });

    element.addEventListener('blur', () => {
        removeFocusedState(); // Remove focused state when input is no longer focused
    });
});

// Mobile menu toggle
document.getElementById("menu-toggle").addEventListener("click", function () {
    var mobileNav = document.querySelector(".mobile_nav");
    if (mobileNav.classList.contains("nav--open")) {
        mobileNav.classList.remove("nav--open");
        mobileNav.style.maxHeight = "0";
        mobileNav.style.opacity = "0";
    } else {
        mobileNav.classList.add("nav--open");
        mobileNav.style.maxHeight = mobileNav.scrollHeight + "px"; // Dynamic height
        mobileNav.style.opacity = "1";
    }
    this.classList.toggle("menu-toggle--open");
});

// Cookie notice
document.getElementById('i-accept').addEventListener('click', function () {
    if (localStorage.hidecookiebar !== '1') {
        document.getElementById('cookie-notice').style.display = 'none';
        localStorage.hidecookiebar = '1';
    }
});

if (localStorage.hidecookiebar == '1') {
    document.getElementById('cookie-notice').style.display = 'none';
}

document.getElementById("loader-wrapper").style.display = 'none';
