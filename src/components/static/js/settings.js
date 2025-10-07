async function initializePage() {
    // Wait for login status to be determined
    await new Promise((resolve) => {
        const checkLoginStatus = () => {
            if (typeof window.isLoggedIn !== 'undefined') {
                resolve();
            } else {
                setTimeout(checkLoginStatus, 100);
            }
        };
        checkLoginStatus();
    });

    // Now that we're sure isLoggedIn is defined, we can use it
    if (!window.isLoggedIn) {
        window.location.href = '/';
        return;
    }

    const userInfo = window.userInfo;
    const csrfToken = $('#csrf_token').val();

    // let planId;
    // if (userInfo.role == 2) {
    //     planId = "#plan2";
    // } else if (userInfo.role == 3) {
    //     planId = "#plan3";
    // } else if (userInfo.role == 4) {
    //     planId = "#plan4";
    // } else {
    //     planId = "#plan1";
    // }
    // const selectedPlan = $(planId);
    // selectedPlan.wrap('<div class="current_plan_container"></div>');
    // selectedPlan.before('<div class="recommended_text">Current Plan</div>');
    // selectedPlan.find('button').text('Selected');
    // selectedPlan.find('button').css({
    //     'cursor': 'not-allowed',
    //     'background-color': 'var(--Text-color-2)',
    //     'pointer-events': 'none'
    // }).prop('disabled', true);
    // selectedPlan.addClass('active');




    // function showMessage_subscription(text, isError = false) {
    //     $('#subscription_message').text(text).css('color', isError ? 'red' : 'green');
    // }
    // function changeSubscription(planKey) {
    //     $.ajax({
    //         url: '/stripe/change_subscription',
    //         method: 'POST',
    //         headers: {
    //             'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
    //             'X-CSRFToken': csrfToken,
    //         },
    //         data: { subscription_key: planKey },
    //         success: function(response) {
    //             if (response.status === 'success') {
    //                 window.location.href = response.checkout_url;
    //             } else {
    //                 showMessage_subscription('Error: ' + response.message, true);
    //             }
    //         },
    //         error: function(xhr) {
    //             showMessage_subscription('Error: ' + xhr.responseJSON.message, true);
    //         }
    //     });
    // }
    // $('#starterplan').click(function() {
    //     changeSubscription('1');
    // });
    // $('#growthplan').click(function() {
    //     changeSubscription('2');
    // });
    // $('#proplan').click(function() {
    //     changeSubscription('3');
    // });
    // $('#cancelSubscription').click(function() {
    //     $.ajax({
    //         url: '/stripe/cancel_subscription',
    //         method: 'POST',
    //         headers: {
    //             'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
    //             'X-CSRFToken': csrfToken,
    //         },
    //         success: function(response) {
    //             // reload the page
    //             window.location.reload();
    //         },
    //         error: function(xhr) {
    //             showMessage_subscription('Error: ' + xhr.responseJSON.message, true);
    //         }
    //     });
    // });






    $.ajax({
        url: '/account/get_user_details',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token')
        },
        success: function(response) {
            $('#name').val(response.name);
            $('#email').val(response.email);
            $('#contact_number').val(response.contact_number);
            $('#address').val(response.address);
            $('#two_factor_auth').prop('checked', response.two_factor_auth);
        },
        error: function(xhr) {
            console.error('Error fetching user details:', xhr.responseText);
        }
    });

    // Update profile information
    $('#profileForm').on('submit', function(e) {
        e.preventDefault();
        $.ajax({
            url: '/account/update_profile',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                'X-CSRFToken': csrfToken,
            },
            data: {
                name: $('#name').val(),
                contact_number: $('#contact_number').val(),
                address: $('#address').val(),
            },
            success: function(response) {
                window.location.reload();
            },
            error: function(xhr) {
                alert('Error updating profile: ' + xhr.responseText);
            }
        });
    });

    // Change password
    $('#passwordForm').on('submit', function(e) {
        e.preventDefault();
        if ($('#new_password').val() !== $('#confirm_password').val()) {
            alert('New passwords do not match');
            return;
        }
        $.ajax({
            url: '/account/change_password',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                'X-CSRFToken': csrfToken,
            },
            data: {
                current_password: $('#current_password').val(),
                new_password: $('#new_password').val(),
                confirm_password: $('#confirm_password').val()
            },
            success: function(response) {
                window.location.reload();
            },
            error: function(xhr) {
                alert('Error changing password: ' + xhr.responseText);
            }
        });
    });

    // Update profile picture
    $('.upload-btn').on('click', function(e) {
        e.preventDefault();
        $('#profile_picture').click();
    });

    $('#profile_picture').on('change', function() {
        var file = this.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                $('#imagePreview').attr('src', e.target.result).show();
            }
            reader.readAsDataURL(file);
            
            var formData = new FormData($('#pfpForm')[0]);
            $.ajax({
                url: '/account/change_pfp',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                    'X-CSRFToken': csrfToken,
                },
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    // alert('Profile picture updated successfully!');
                },
                error: function(xhr) {
                    alert('Error updating profile picture: ' + xhr.responseText);
                }
            });
        }
    });

    
    // Toggle two-factor authentication
    $('#two_factor_auth').on('change', function() {
        $.ajax({
            url: '/account/toggle_2fa',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                'X-CSRFToken': csrfToken,
            },
            data: {
                toggle_to: this.checked ? '1' : '0'
            },
            success: function(response) {
                window.location.reload();
            },
            error: function(xhr) {
                alert('Error updating two-factor authentication: ' + xhr.responseText);
                $('#two_factor_auth').prop('checked', !$('#two_factor_auth').prop('checked'));
            }
        });
    });


    // Show modal when 'Delete Account' button is clicked
    $('#deleteAccountBtn').on('click', function() {
        $('#deleteAccountModal').fadeIn();
    });

    // Close modal when 'X' (close button) is clicked and clear the form
    $('#closeModal').on('click', function() {
        $('#deleteAccountModal').fadeOut();
        $('#deleteAccountForm')[0].reset();  // Clear the input field
    });

    // Handle form submission
    $('#deleteAccountForm').on('submit', function(e) {
        e.preventDefault(); // Prevent the form from submitting the default way

        const userInput = $('#deleteConfirmation').val().trim().toLowerCase();

        if (userInput === 'confirm') {
            $.ajax({
                url: '/account/delete_account',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                    'X-CSRFToken': csrfToken,
                },
                success: function(response) {
                    if (response.status === 'success') {
                        localStorage.removeItem('jwt_token');
                        window.location.href = '/';
                    } else {
                        alert('Failed to delete account: ' + response.message);
                    }
                },
                error: function(xhr) {
                    alert('Error deleting account: ' + xhr.responseText);
                }
            });

            $('#deleteAccountModal').fadeOut();  // Close the modal
            $('#deleteAccountForm')[0].reset();  // Clear the input field
        } else {
            alert('Please type "confirm" correctly to delete the account.');
        }
    });




    $.ajax({
        url: '/account/check_security_answer',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
            'X-CSRFToken': csrfToken,
        },
        success: function(response) {
            if (response.status === 'success') {
                $('#securityQuestionSection').css('display', 'none');
            }
        },
        error: function(xhr) {
            $('#securityQuestionSection').css('display', 'block');
        }
    });

    $('#securityQuestionForm').on('submit', function(e) {
        e.preventDefault(); // Prevent the form from submitting the default way

        const securityQuestion = $('#security_question').val().trim();
        const securityAnswer = $('#security_answer').val().trim();

        if (securityQuestion !== '' && securityAnswer !== '') {
            $.ajax({
                url: '/account/upload_security_question_answer',
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                    'X-CSRFToken': csrfToken,
                },
                data: {
                    security_question: securityQuestion,
                    security_answer: securityAnswer
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#securityQuestionSection').hide();
                    } else {
                        alert('Failed to upload security question and answer: ' + response.message);
                    }
                },
                error: function(xhr) {
                    alert('Error uploading security question and answer: ' + xhr.responseText);
                }
            });
        } else {
            alert('Please select a security question and enter a non-empty answer.');
        }
    });






    

    
};


$(document).ready(function() {
    initializePage();
});