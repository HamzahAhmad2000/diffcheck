$(document).ready(async function () {
  function logout() {
    const jwtToken = localStorage.getItem('jwt_token');
    const refreshToken = localStorage.getItem('refresh_token');
    if (!jwtToken || !refreshToken) {
      window.isLoggedIn = false;
      updateUI(false);
      return;
    }
    $.ajax({
      url: '/account/logout',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + jwtToken,
        'X-CSRFToken': csrfToken,
      },
      success: function (response) {
        if (response.status === 'success') {
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/';
        } else {
          console.error('Failed to log out:', response.message);
        }
      },
      error: function (xhr) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/';
        console.error('Error logging out:', xhr.responseText);
      }
    });
  }

  async function checkLoginStatus() {
    let admin_token = localStorage.getItem('admin_key');
    if (admin_token) {
      window.location.href = '/admin';
      return;
    }
    let partner_token = localStorage.getItem('partner_token');
    if (partner_token) {
      window.location.href = '/partner';
      return;
    }
    let token = localStorage.getItem('jwt_token');
    if (!token) {
      logout();
      return;
    }
    try {
      // First, try to verify the token
      $.ajax({
        url: '/account/verify_token',
        type: 'POST',
        dataType: 'json',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'X-CSRFToken': csrfToken,
        },
        success: function (data) {
          if (data.status === 'success') {
            window.userInfo = data.user_info;
            window.isLoggedIn = true;
            updateUI(true);
          } else {
            logout();
          }
        },
        error: function (xhr) {
          if (xhr.status === 401) {
            // Token is expired, try to refresh the token
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              $.ajax({
                url: '/account/refresh',
                type: 'POST',
                dataType: 'json',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + refreshToken,
                  'X-CSRFToken': csrfToken,
                },
                success: function (data) {
                  if (data.access_token) {
                    localStorage.setItem('jwt_token', data.access_token);
                    // Retry the checkLoginStatus after getting a new token
                    checkLoginStatus();
                  } else {
                    logout();
                  }
                },
                error: function () {
                  console.error('Error refreshing token');
                  logout();
                }
              });
            } else {
              logout();
            }
          } else {
            logout();
          }
        }
      });
    } catch (error) {
      console.error('Error checking login status:', error);
      logout();
    }
  }

  function updateUI(isLoggedIn) {
    if (isLoggedIn) {
      $('.logged-in-content').show();
      $('.logged-out-content').hide();
      $('#user-name').text(window.userInfo.name);
      $('#user-pfp').attr('src', `/static/pfps/${window.userInfo.pfp}`);
      updateNavbar(true);
      populateCartModal();
    } else {
      $('.logged-in-content').hide();
      $('.logged-out-content').show();
      // updateNavbar(false);
      $('#cart_btn').hide();
    }
  }

  // Initialize the login check (AJAX-based verification)
  await checkLoginStatus();



  const indicators = document.querySelectorAll('.indicator');
  const descriptions = document.querySelectorAll('.slide_description');
  const details_text = document.querySelectorAll('.slide_details_text');
  const details_images = document.querySelectorAll('.details_assets_img');


  function setActiveSlide(slideNumber) {
    // Update indicators
    indicators.forEach(indicator => {
      indicator.classList.remove('active');
      if (indicator.dataset.slide === slideNumber) {
        indicator.classList.add('active');
      }
    });

    // Update descriptions
    descriptions.forEach(description => {
      description.classList.remove('active');
      if (description.dataset.slide === slideNumber) {
        description.classList.add('active');
      }
    });

    // Update details text
    details_text.forEach(description => {
      description.classList.remove('active');
      if (description.dataset.slide === slideNumber) {
        description.classList.add('active');
      }
    });

    // Update details image
    details_images.forEach(description => {
      description.classList.remove('active');
      if (description.dataset.slide === slideNumber) {
        description.classList.add('active');
      }
    });
  }

  // Add click handlers to indicators
  indicators.forEach(indicator => {
    indicator.addEventListener('click', () => {
      setActiveSlide(indicator.dataset.slide);
    });
  });

  // Auto-advance slides every 5 seconds
  // let currentSlide = 1;
  // setInterval(() => {
  //     currentSlide = currentSlide >= 3 ? 1 : currentSlide + 1;
  //     setActiveSlide(currentSlide.toString());
  // }, 5000);





  const cards = document.querySelectorAll('.service_card');
  let currentIndex = 0;
  let progressWidth = 0;
  let animationFrameId;
  let lastTimestamp;

  const ROTATION_INTERVAL = 5000; // 5 seconds per card

  function setActiveCard(index) {
    // Reset all cards
    cards.forEach(card => {
      card.classList.remove('active');
      card.querySelector('.progress_bar').style.width = '0%';
    });

    // Activate new card
    cards[index].classList.add('active');
    currentIndex = index;
    progressWidth = 0;
    lastTimestamp = null;
  }

  function updateProgress(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const elapsed = timestamp - lastTimestamp;

    progressWidth = (elapsed / ROTATION_INTERVAL) * 100;

    // Update only active card's progress bar
    const activeCard = document.querySelector('.service_card.active');
    if (activeCard) {
      const progressBar = activeCard.querySelector('.progress_bar');
      progressBar.style.width = `${Math.min(progressWidth, 100)}%`;
    }

    if (progressWidth >= 100) {
      currentIndex = (currentIndex + 1) % cards.length;
      setActiveCard(currentIndex);
    }

    animationFrameId = requestAnimationFrame(updateProgress);
  }

  // Initialize first card and start animation
  setActiveCard(0);
  animationFrameId = requestAnimationFrame(updateProgress);

  // Add click handlers to cards
  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (index !== currentIndex) {
        cancelAnimationFrame(animationFrameId);
        setActiveCard(index);
        animationFrameId = requestAnimationFrame(updateProgress);
      }
    });
  });
  const steps = document.querySelectorAll('.pipeline_step');
  let currentStep = 0;

  function setActiveStep(index) {
    steps.forEach(step => step.classList.remove('active'));
    steps[index].classList.add('active');
  }

  // Auto advance steps
  setInterval(() => {
    currentStep = (currentStep + 1) % steps.length;
    setActiveStep(currentStep);
  }, 3000);

  // Form validation and handling
  const form = document.getElementById('contactForm');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    // Basic form validation
    const formData = new FormData(form);
    let isValid = true;

    formData.forEach((value, key) => {
      if (key !== 'phone' && !value) { // Phone is optional
        isValid = false;
      }
    });

    if (isValid) {
      // Here you would typically send the form data to your server
      console.log('Form submitted:', Object.fromEntries(formData));
      form.reset();
    }
  });


  var owl = $('.owl-carousel');

  // Initialize Owl Carousel
  owl.owlCarousel({
    loop: true,
    nav: false,
    dots: true, // Enable dots for tracking
    responsive: {
      0: {
        items: 1
      },
      900: {
        items: 2
      }
    }
  });

  // Sync Owl Carousel dots with custom dots container
  function syncDots() {
    $('.carousel_dots').empty(); // Clear previous dots
    $('.owl-dots .owl-dot').each(function (index) {
      $('.carousel_dots').append('<span class="custom_dot" data-index="' + index + '"></span>');
    });

    updateActiveDot(); // Ensure the active dot is set initially
  }

  // Update active dot in custom control
  function updateActiveDot() {
    var activeIndex = $('.owl-dot.active').index();
    $('.custom_dot').removeClass('active');
    $('.custom_dot').eq(activeIndex).addClass('active');
  }

  // Sync the custom dots on load
  syncDots();

  // Click event for custom dots
  $(document).on('click', '.custom_dot', function () {
    var index = $(this).data('index');
    owl.trigger('to.owl.carousel', [index, 300]);
  });

  // Click event for custom next and prev buttons
  $('.carousel_buttons button:first-child').click(function () {
    owl.trigger('prev.owl.carousel');
  });

  $('.carousel_buttons button:last-child').click(function () {
    owl.trigger('next.owl.carousel');
  });

  // Update custom dots on slide change
  owl.on('changed.owl.carousel', function () {
    updateActiveDot();
  });


});


const pillButton = {
  setSelected: function (option) {
    const pill = document.getElementById('pill_button__pill');
    const businessBtn = document.getElementById('pill_button__business');
    const participantBtn = document.getElementById('pill_button__participant');

    pill.style.transform = option === 'business'
      ? 'translateX(0)'
      : 'translateX(calc(110%))';

    businessBtn.classList.toggle('active', option === 'business');
    participantBtn.classList.toggle('active', option === 'participant');
  }
};


