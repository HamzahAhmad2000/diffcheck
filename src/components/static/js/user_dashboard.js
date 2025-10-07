$(document).ready(async function () {
  const csrfToken = $('#csrf_token').val();


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
    $('.logout_button').on('click', function () {
      logout();
    });

    });