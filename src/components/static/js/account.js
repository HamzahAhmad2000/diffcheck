$(document).ready(function() {
    function checkScreenWidth() {
        let extraInfo = document.querySelector(".extra_info");
        let formContainer = document.querySelector(".form_container");
    
        if (window.innerWidth < 900) {
            extraInfo.classList.add("hidden");
            formContainer.style.flex = "1 1 100%"; // Expand form container
        } else {
            extraInfo.classList.remove("hidden");
            formContainer.style.flex = "1"; // Reset to 50%
        }
    }
    
    // Run the function initially
    checkScreenWidth();
    
    // Listen for screen resize events
    window.addEventListener("resize", checkScreenWidth);

    

    function setToken(access_token, refresh_token) {
        localStorage.setItem('jwt_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
    }

    function getToken() {
        return localStorage.getItem('jwt_token');
    }

    
    const csrfToken = $('#csrf_token').val();

    const previousPage = document.referrer && !document.referrer.includes('/login') ? document.referrer : '/';


    // Validation functions
    function validateName(name) {
        if (name.length === 0) {
            return true;
        }
        return name.trim().length >= 3 && name.trim().length <= 30 && /^[a-zA-Z\s'-]+$/.test(name) && new Set(name.replace(/\s/g,'')).size >= 2;
    }

    function validateEmail(email) {
        if (email.length === 0) {
            return true;
        }
        return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
    }

    function validatePassword(password) {
        if (password.length === 0) {
            return true;
        }
        return password.length >= 8 && password.length <= 30 && 
               /[A-Z]/.test(password) && /[a-z]/.test(password) && 
               /[0-9]/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password);
    }

    function validateProfilePicture(file) {
        if (!file) {
            $('#profilePicturePreview').css('display', 'none');
            $('#registerProfilePictureError').text('');
            return true;
        }
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        const isValid = validTypes.includes(file.type) && file.size <= 5 * 1024 * 1024;
        $('#profilePicturePreview').css('display', isValid ? 'block' : 'none');
        $('#registerProfilePictureError').text(isValid ? '' : 'Invalid file. Max size: 5MB, Types: PNG, JPG, JPEG');
        return isValid;
    }
    function validateField(field, validationFunction, errorElement) {
        const isValid = validationFunction(field.value);
        field.classList.toggle('valid', isValid);
        field.classList.toggle('invalid', !isValid);
        errorElement.textContent = isValid ? '' : 'Invalid input';
        return isValid;
    }

    function extrainfocontrol(swap, change) {
        let extraInfo = document.querySelector(".extra_info");
        let extraInfoOne = document.querySelector(".extra_info_one");

        extraInfo.classList.toggle("swapped", swap);
        extraInfoOne.classList.toggle("hidden", change);
    }

    // Event listeners for form inputs
    $('#registerName').on('input', function() {
        validateField(this, validateName, document.getElementById('register_message'));
    });
    $('#registerEmail').on('input', function() {
        validateField(this, validateEmail, document.getElementById('register_message'));
    });
    $('#registerPassword').on('input', function() {
        validateField(this, validatePassword, document.getElementById('register_message'));
    });
    $('#registerConfirmPassword').on('input', function() {
        const isValid = this.value === $('#registerPassword').val();
        this.classList.toggle('valid', isValid);
        this.classList.toggle('invalid', !isValid)
        document.getElementById('register_message').textContent = isValid ? '' : 'Passwords do not match';
    });
    $('#customUploadButton').on('click', function() {
        $('#registerProfilePicture').click();
    });
    $('#registerProfilePicture').on('change', function() {
        var file = this.files[0];
        handleFileSelection(file);
    });

    $('#file_remove').on('click', function(e) {
        e.preventDefault();
        $('#registerProfilePicture').val('');
        $('#selectedFileName').text('');
        $('#file_remove').css('display', 'none');
        $('#profilePicturePreview').css('display', 'none');
        $('#registerProfilePictureError').text('');
        $('.file_info').css('justify-content', 'center');

        $('.custom-file-upload-text').css('display', 'flex');
        $('#customUploadButton').css('padding', '20px');
        $('#customUploadButton').css('height', '100px');
    });

    $('#loginEmail').on('input', function() {
        validateField(this, validateEmail, document.getElementById('login_message'));
    });
    $('#loginPassword').on('input', function() {
        validateField(this, validatePassword, document.getElementById('login_message'));
    });
    $('.otp_code').on('input', function() {
        this.value = this.value.toUpperCase();
        if (this.value.length === this.maxLength) {
            $(this).next('.otp_code').focus();
        }
    });

    $('#securityQuestion').on('input', function() {
        validateField(this, (question) => question.trim().length > 0, document.getElementById('complete_registration_message'));
    });

    $('#securityAnswer').on('input', function() {
        validateField(this, (answer) => answer.trim().length > 0, document.getElementById('complete_registration_message'));
    });

    $('#forgotPasswordEmail').on('input', function() {
        validateField(this, validateEmail, document.getElementById('forgot_password_message'));
    });

    $('#register_terms_and_condition').on('change', function() {
        $('#register_message').text('');
    });
    
    // Register form submission
    $('#registerForm').on('submit', function(e) {
        e.preventDefault();
        
        $('.loading_container').addClass('active');
        
        let isValid = true;
        isValid &= validateField(document.getElementById('registerName'), validateName, document.getElementById('register_message'));
        isValid &= validateField(document.getElementById('registerEmail'), validateEmail, document.getElementById('register_message'));
        isValid &= validateField(document.getElementById('registerPassword'), validatePassword, document.getElementById('register_message'));
        isValid &= document.getElementById('registerPassword').value === document.getElementById('registerConfirmPassword').value;
        isValid &= validateProfilePicture(document.getElementById('registerProfilePicture').files[0]);

        if (!$('#register_terms_and_condition').is(':checked')) {
            $('#register_message').text('You must agree to the Terms & Conditions to proceed.');
            $('.loading_container').removeClass('active');
            return;
        } else {
            $('#register_message').text('');
        }

        if (!isValid) {
            $('#register_message').text('Please correct the errors in the form.');
            $('.loading_container').removeClass('active');
            return;
        }

        let formData = new FormData(this);

        $.ajax({
            url: '/account/register',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                if (response.status === 'success') {
                    $('#registerForm').hide();
                    $('#register_message').hide();
                    clearForm('#registerForm');
                    
                    $('.form_heading').text('OTP Verification');
                    $('.form_sub_heading').text('Please enter the OTP sent to your email.').show();
                    
                    $('#otpForm').css('display', 'flex');
                    $('#otp_message').css('display', 'block');
                } else {
                    $('#register_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#register_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    let tempEmail = '';
    let tempRememberMe = false;

    // Login form submission
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();

        $('.loading_container').addClass('active');

        let isValid = true;
        isValid &= validateField(document.getElementById('loginEmail'), validateEmail, document.getElementById('login_message'));
        isValid &= validateField(document.getElementById('loginPassword'), (password) => password.length > 0, document.getElementById('login_message'));

        if (!isValid) {
            $('#login_message').text('Please correct the errors in the form.').css('color', 'red');
            $('.loading_container').removeClass('active');
            return;
        }

        var formData = new FormData(this);
        $.ajax({
            url: '/account/login',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                if (response.type == 1) {
                    $('#login_message').text(response.message);
                    if (response.status === 'success') {
                        if (response.access_token) {
                            setToken(response.access_token, response.refresh_token);
                        }
                        window.location.href = previousPage;
                    } else {
                        $('#login_message').css('color', 'red');
                    }
                }
                if (response.type == 2) {
                    $('#login_message').text(response.message);
                    if (response.status === 'success') {
                        tempEmail = $('#loginEmail').val();
                        tempRememberMe = $('#loginRememberMe').is(':checked');
                        showTwoFactorAuthForm();
                    } else {
                        $('#login_message').css('color', 'red');
                    }
                }
                if (response.type == 3) {
                    $('#login_message').text(response.message);
                    if (response.status === 'success') {
                        if (response.access_token) {
                            setToken(response.access_token, response.refresh_token);
                        }
                        showRestoreAccountForm();
                    } else {
                        $('#login_message').css('color', 'red');
                    }
                }
                if (response.type == 4) {
                    localStorage.setItem('admin_key', response.key);
                    window.location.href = '/admin';
                }
                if (response.type == 5) {
                    $('#login_message').text(response.message);
                    if (response.status === 'success') {
                        if (response.partner_token) {
                            localStorage.setItem('partner_token', response.partner_token);
                        }
                        window.location.href = '/partner';
                    } else {
                        $('#login_message').css('color', 'red');
                    }
                }
            },
            error: function(xhr) {
                $('#login_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // 2fa form submission
    $('#twoFactorAuthForm').on('submit', function(e) {
        e.preventDefault();

        $('.loading_container').addClass('active');

        let code = $('#twoFactorAuthCode').val();

        let formData = new FormData();
        formData.append('email', tempEmail);
        formData.append('code', code);
        formData.append('remember_me', tempRememberMe);

        $.ajax({
            url: '/account/verify_two_factor',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                if (response.status === 'success') {
                    setToken(response.access_token, response.refresh_token);
                    window.location.href = previousPage;
                } else {
                    $('#two_factor_auth_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#two_factor_auth_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // Account restoration form submission
    $('#restore_account_button').on('click', function(e) {
        $('.loading_container').addClass('active');

        $.ajax({
            url: '/account/restore_account',
            type: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Authorization': 'Bearer ' + getToken()
            },
            success: function(response) {
                if (response.status === 'success') {
                    window.location.href = '/';
                } else {
                    $('#restore_account_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#restore_account_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // Account deletion confirmation form submission
    $('#confirm_deletion_button').on('click', function(e) {
        $('.loading_container').addClass('active');

        $.ajax({
            url: '/account/confirm_deletion',
            type: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Authorization': 'Bearer ' + getToken()
            },
            success: function(response) {
                if (response.status === 'success') {
                    window.location.href = '/';
                } else {
                    $('#confirm_deletion_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#confirm_deletion_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // OTP form submission
    $('#otpForm').on('submit', function(e) {
        e.preventDefault();

        $('.loading_container').addClass('active');

        let otpCode = '';
        $('.otp_code').each(function() {
            otpCode += $(this).val();
        });

        let isValid = /^[A-Z0-9]{6}$/.test(otpCode);

        if (!isValid) {
            $('#otp_message').text('Please enter a valid 6-digit OTP.').css('color', 'red');
            $('.loading_container').removeClass('active');
            return;
        }

        let formData = new FormData();
        formData.append('otp', otpCode);
    
        $.ajax({
            url: '/account/verify_OTP',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                if (response.status === 'success') {
                    setToken(response.access_token, response.refresh_token);
                    $('#otpForm').hide();
                    $('#otp_message').hide();
                    clearForm('#otpForm');

                    $('.form_heading').text("Complete Registration");
                    $('.form_subheading').text("Please provide additional information to complete your registration.").show();

                    $('#completeRegistrationForm').css('display', 'flex');
                    $('#complete_registration_message').css('display', 'block');
                } else {
                    $('#otp_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#otp_message').text(xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });
    
    // Resend OTP
    $('#resend-otp').on('click', function() {
        $('.loading_container').addClass('active');

        $.ajax({
            url: '/account/resend_OTP',
            type: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                $('#otp_message').text(response.message);
                if (response.status === 'success') {
                    $('#otp_message').css('color', 'green');
                } else {
                    $('#otp_message').css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#otp_message').text('Error: ' + xhr.responseJSON.message).css('color', 'red');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // Complete Registration form submission
    $("#completeRegistrationForm").submit(function (e) {
        e.preventDefault();

        // Get values
        let dob = $("#dateInput").val().trim();
        let country = $("#selectedCountryInput").val().trim();
        let securityQuestion = $("#securityQuestion").val().trim();
        let securityAnswer = $("#securityAnswer").val().trim();
        let twoFactorAuth = $("#twoFactorAuth").is(":checked") ? 1 : 0;

        // Get selected interests
        let selectedInterests = [];
        document.querySelectorAll('.pill-option.selected').forEach(pill => {
            selectedInterests.push(pill.dataset.value);
        });

        let interestsString = selectedInterests.join(",");

        // Validation
        if (!dob || !country || !securityQuestion || !securityAnswer || selectedInterests.length === 0) {
            alert("Please fill in all required fields.");
            return;
        }

        // Form data
        let formData = new FormData();
        formData.append("dob", dob);
        formData.append("country", country);
        formData.append("interests", interestsString);
        formData.append("security_question", securityQuestion);
        formData.append("security_answer", securityAnswer);
        formData.append("two_factor_auth", twoFactorAuth);

        // Show loading animation
        $(".loading_container").addClass("active");

        // AJAX Request
        $.ajax({
            url: "/account/complete_registration",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                "X-CSRFToken": csrfToken,
                "Authorization": "Bearer " + getToken()
            },
            success: function (response) {
                if (response.status === "success") {
                    setToken(response.access_token, response.refresh_token);
                    window.location.href = "/";
                } else {
                    $("#complete_registration_message").text(response.message).css({ "color": "red", "display": "flex" });
                }
            },
            error: function (xhr) {
                $("#complete_registration_message").text(xhr.responseJSON?.message || "An error occurred. Please try again.")
                    .css({ "color": "red", "display": "flex" });
            },
            complete: function () {
                $(".loading_container").removeClass("active");
            }
        });
    });
    
    // Forgot Password form submission
    $('#forgotPasswordForm').on('submit', function(e) {
        e.preventDefault();

        $('.loading_container').addClass('active');

        let isValid = validateField(document.getElementById('forgotPasswordEmail'), validateEmail, document.getElementById('forgot_password_message'));

        if (!isValid) {
            $('#forgot_password_message').text('Please enter a valid email address.').css('color', 'red');
            $('.loading_container').removeClass('active');
            return;
        }

        let formData = new FormData(this);

        $.ajax({
            url: "/account/forgot_password",
            method: "POST",
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrfToken,
            },
            success: function(response) {
                $('#forgot_password_message').text(response.message);
                if (response.status === 'success') {
                    $('#forgot_password_message').css('color', 'green');
                } else {
                    $('#forgot_password_message').css('color', 'red');
                }
            },
            error: function(xhr) {
                $('#forgot_password_message').text("Password reset link sent to your email").css('color', 'green');
            },
            complete: function() {
                $('.loading_container').removeClass('active');
            }
        });
    });

    // Helper functions
    function togglePassword(inputId, toggleId) {
        $(toggleId).on('click', function() {
            var input = $(inputId);
            if (input.attr('type') === 'password') {
                input.attr('type', 'text');
                $(this).html('<i class="ri-eye-close-fill ri-xl"></i>');
            } else {
                input.attr('type', 'password');
                $(this).html('<i class="ri-eye-fill ri-xl"></i>');
            }
        });
    }

    togglePassword('#registerPassword', '#toggleRegisterPassword');
    togglePassword('#registerConfirmPassword', '#toggleRegisterConfirmPassword');
    togglePassword('#loginPassword', '#toggleLoginPassword');

    function handleFileSelection(file) {
        var fileName = file ? file.name : '';
        $('#selectedFileName').text(fileName);
        $('#file_remove').css('display', file ? 'block' : 'none');
        $('.file_info').css('justify-content', 'space-between');

        handleFileUploadPreview(file);
    }

    function handleFileUploadPreview(file) {
        var reader = new FileReader();
        var preview = $('#profilePicturePreview');

        reader.onloadend = function() {
            preview.attr('src', reader.result);
            preview.css('display', 'block');

            $('.custom-file-upload-text').css('display', 'none');
            $('#customUploadButton').css('padding', '0px');
            $('#customUploadButton').css('height', '200px');
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            preview.attr('src', '');
            preview.css('display', 'none');

            $('.custom-file-upload-text').css('display', 'flex');
            $('#customUploadButton').css('padding', '20px');
            $('#customUploadButton').css('height', '200px');
        }
    }
    // Drag and drop events
    $('#customUploadButton').on('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('dragover');
    });

    $('#customUploadButton').on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');
    });

    $('#customUploadButton').on('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('dragover');

        var file = e.originalEvent.dataTransfer.files[0];
        handleFileSelection(file);
    });
    function clearForm(form_id) {
        $(`${form_id} input[type="text"]`).val('');
        $(`${form_id} input[type="email"]`).val('');
        $(`${form_id} input[type="password"]`).val('');
        $(`${form_id} input[type="checkbox"]`).prop('checked', false);
        
        if (form_id === '#registerForm') {          
            $('#selectedFileName').text('');
            $('#file_remove').click();
        }
    }

    // Form toggle events
    $('#register_form_shower').on('click', function() {
        extrainfocontrol(true, true);
        $('#loginForm').hide();
        $('#login_message').hide();
        clearForm('#loginForm');

        $('#registerForm').css('display', 'flex');
        $('#register_message').css('display', 'block');

        $('.form_subheading').hide();
        $('.form_heading').text("Sign Up");

    });

    $('#login_form_shower').on('click', function() {
        extrainfocontrol(false, false);
        $('#registerForm').hide();
        $('#register_message').hide();
        clearForm('#registerForm');

        $('#loginForm').css('display', 'flex');
        $('#login_message').css('display', 'block');

        $('.form_subheading').css('display', 'block');
        $('.form_subheading').text("Please enter your details");
        $('.form_heading').text("Welcome Back");
    });

    function showRestoreAccountForm() {
        $('#loginForm').hide();
        $('#login_message').hide();
        clearForm('#loginForm');

        $('#restoreAccountForm').css('display', 'flex');
        $('#restore_account_message').css('display', 'flex');

        $('.form_heading').text('Restore Account');
        $('.form_subheading').text('Your account will be automatically deleted after 15 days');
    }
    $('.restore_back_button_container').on('click', function() {
        $('#restoreAccountForm').css('display', 'none');
        $('#restore_account_message').css('display', 'none');
        clearForm('#restoreAccountForm');

        $('#loginForm').css('display', 'flex');
        $('#login_message').css('display', 'block');

        $('.form_heading').text('Welcome Back');
        $('.form_subheading').text('Please enter your details');
    });

    function showTwoFactorAuthForm() {
        $('#loginForm').hide();
        $('#login_message').hide();
        clearForm('#loginForm');

        $('#twoFactorAuthForm').css('display', 'flex');
        $('#two_factor_auth_message').css('display', 'flex');

        $('.form_heading').text('Two-Factor Authentication');
        $('.form_subheading').text('Please enter the code sent to your email');
    }

    $('.two_factor_auth_back_button_container').on('click', function() {
        $('#twoFactorAuthForm').css('display', 'none');
        $('#two_factor_auth_message').css('display', 'none');
        clearForm('#twoFactorAuthForm');

        $('#loginForm').css('display', 'flex');
        $('#login_message').css('display', 'block');
        
        $('.form_heading').text('Welcome Back');
        $('.form_subheading').text('Please enter your details');
    });


    $('#forgot_password_btn').on('click', function() {
        $('#loginForm').hide();
        $('#login_message').hide();
        clearForm('#loginForm');

        $('#forgotPasswordForm').css('display', 'flex');
        $('#forgot_password_message').css('display', 'block');

        $('.form_heading').text('Forgot Password');
        $('.form_subheading').hide();
    });

    $('.forgot_password_button_container button').on('click', function() {
        $('#loginForm').css('display', 'flex');
        $('#login_message').css('display', 'block');
        
        $('#forgotPasswordForm').hide();
        $('#forgot_password_message').text('').hide();
        $('#forgotPasswordForm input').val('');

        $('.form_heading').text('Welcome Back');
        $('.form_subheading').text('Please enter your details');
        $('.form_subheading').css('display', 'block');
    });


    $('#restore_account_button').on('click', function() {
        if (!localStorage.getItem('jwt_token')) {
            $('#restore_account_message').text('Error: JWT token not found in local storage').css('color', 'red').css('display', 'flex');
        } else {
            $.ajax({
                url: '/restore_account',
                type: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + localStorage.getItem('jwt_token'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        window.location.href = '/';
                    } else {
                        $('#restore_account_message').text(response.message).css('color', 'red').css('display', 'flex');
                    }
                },
                error: function(xhr) {
                    $('#restore_account_message').text(xhr.responseJSON.message).css('color', 'red').css('display', 'flex');
                }
            });
        }
    });



    // Custom dropdown
    const selectedQuestion = document.getElementById('selectedQuestion');
    const dropdownOptions = document.getElementById('dropdownOptions');
    const dropdownArrow = document.getElementById('dropdownArrow');
    const securityQuestionInput = document.getElementById('securityQuestion');

    selectedQuestion.addEventListener('click', () => {
        dropdownOptions.style.display = dropdownOptions.style.display === 'block' ? 'none' : 'block';
        dropdownArrow.style.transform = dropdownOptions.style.display === 'block' ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    document.querySelectorAll('.dropdown-option').forEach(option => {
        option.addEventListener('click', () => {
            selectedQuestion.querySelector('p').textContent = option.textContent;
            securityQuestionInput.value = option.getAttribute('data-value');
            dropdownOptions.style.display = 'none';
            dropdownArrow.style.transform = 'rotate(0deg)';
        });
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.custom-dropdown')) {
            dropdownOptions.style.display = 'none';
            dropdownArrow.style.transform = 'rotate(0deg)';
        }
    });

    // OTP back button
    $('.otp_back_button_container button').on('click', function() {
        $('#otpForm').hide();
        $('#otp_message').hide();
        clearForm('#otpForm');

        $('#registerForm').css('display', 'flex');
        $('#register_message').css('display', 'block');

        $('.form_heading').text('Sign Up');
        $('.form_subheading').hide();
    });



    function handleGoogleAuthResponse(response) {
        if (response.status === 'success') {
            switch (response.authType) {
                case 'login':
                    setToken(response.token, response.refresh_token);
                    window.location.href = '/dashboard';
                    break;
                case '2fa':
                    tempEmail = response.g_email;
                    tempRememberMe = true;
                    showTwoFactorAuthForm();
                    break;
                case 'restore':
                    setToken(response.token, response.refresh_token);
                    showRestoreAccountForm();
                    break;
                case 'register':
                    $('#loginForm').hide();
                    $('#login_message').hide();
                    clearForm('#loginForm');
                    $('#registerForm').hide();
                    $('#register_message').hide();
                    clearForm('#registerForm');

                    $('.form_heading').text("Complete Registration");
                    $('.form_subheading').text("Please provide additional information to complete your registration.").show();

                    $('#completeRegistrationForm').css('display', 'flex');
                    $('#complete_registration_message').css('display', 'block');
                    break;
                default:
                    console.error('Unknown auth type:', response.authType);
            }
        } else {
            console.error('Error during authentication:', response.message);
            $('#login_message, #register_message').text(response.message).css('color', 'red');
        }
    }



    window.addEventListener('message', function(event) {
        if (event.origin === window.location.origin && event.data.type === 'auth') {
            handleGoogleAuthResponse(event.data);
        }
    });

    $('.googleAuthBtn').on('click', function(e) {
        e.preventDefault();
        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open('/googleAuth', 'GoogleAuth', `width=${width},height=${height},left=${left},top=${top}`);
    });


// //////////////////////////////////////////////////////////////////////////////////// This will be used in conjunction with layout.js to check login status
    // Update UI based on login status
    function updatesite() {
        if (window.isLoggedIn) {
            $('.logged-in-content').show();
            $('.logged-out-content').hide();
        } else {
            $('.logged-in-content').hide();
            $('.logged-out-content').show();
        }
    }
    // Check login status and update UI accordingly
    if (typeof window.isLoggedIn !== 'undefined') {
        updatesite();
    } else {
        const checkLoginStatus = setInterval(() => {
            if (typeof window.isLoggedIn !== 'undefined') {
                clearInterval(checkLoginStatus);
                updatesite();
            }
        }, 100);
    }




    document.getElementById("customDate").addEventListener("click", function() {
        const dateInput = document.getElementById("dateInput");
        dateInput.showPicker();
    });

    document.getElementById("dateInput").addEventListener("change", function() {
        document.getElementById("customDate").textContent = this.value || "Select Date";
    });







      // Select country dropdown elements using their unique IDs.
      const countrySelect = document.getElementById('countrySelect');
      const countryDropdownOptions = document.getElementById('countryDropdownOptions');
      const countryDropdownArrow = document.getElementById('countryDropdownArrow');
      const selectedCountryInput = document.getElementById('selectedCountryInput');

      // Toggle dropdown options when the header is clicked.
      countrySelect.addEventListener('click', (e) => {
        if (countryDropdownOptions.style.display === 'block') {
          countryDropdownOptions.style.display = 'none';
          countryDropdownArrow.style.transform = 'rotate(0deg)';
        } else {
          countryDropdownOptions.style.display = 'block';
          countryDropdownArrow.style.transform = 'rotate(180deg)';
        }
        // Stop the event from propagating to avoid immediate closing.
        e.stopPropagation();
      });

      // Update selection when clicking on a country option.
      document.querySelectorAll('.dropdown-option-country').forEach(option => {
        option.addEventListener('click', (e) => {
          countrySelect.querySelector('p').textContent = option.textContent;
          selectedCountryInput.value = option.getAttribute('data-value');
          // Close the dropdown.
          countryDropdownOptions.style.display = 'none';
          countryDropdownArrow.style.transform = 'rotate(0deg)';
          e.stopPropagation();
        });
      });

      // Close the dropdown when clicking outside of it.
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown-country')) {
          countryDropdownOptions.style.display = 'none';
          countryDropdownArrow.style.transform = 'rotate(0deg)';
        }
      });

    // Select all the pill elements
    const pills = document.querySelectorAll('.pill-option');

    // Attach a click event to each pill
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        // Toggle the "selected" class on click.
        pill.classList.toggle('selected');
        
        // For demonstration, you can log the value.
        console.log(`Pill ${pill.dataset.value} is now ${pill.classList.contains('selected') ? 'selected' : 'deselected'}`);
      });
    });
});













let eclipseerCurrentIndex = 1;
let eclipseerInterval;

function eclipseerShowContent(index, resetTimer = false) {
    // Remove active class from all buttons
    document.querySelectorAll('.eclipseer_unique_tab_button').forEach(button => button.classList.remove('eclipseer_active'));
    // Add active class to clicked button
    document.querySelectorAll('.eclipseer_unique_tab_button')[index - 1].classList.add('eclipseer_active');

    // Hide all content items
    document.querySelectorAll('.eclipseer_unique_content_item').forEach(item => item.classList.remove('eclipseer_active'));
    // Show the corresponding content
    document.getElementById(`eclipseer_content_${index}`).classList.add('eclipseer_active');

    // Update index for automatic switching
    eclipseerCurrentIndex = index;

    // Reset interval if the user manually clicks a button
    if (resetTimer) {
        clearInterval(eclipseerInterval);
        eclipseerStartAutoSwitch();
    }
}

function eclipseerStartAutoSwitch() {
    eclipseerInterval = setInterval(() => {
        eclipseerCurrentIndex = (eclipseerCurrentIndex % 3) + 1; // Loop from 1 to 3
        eclipseerShowContent(eclipseerCurrentIndex);
    }, 5000); // Change content every 5 seconds
}

// Start the automatic switching when the page loads
eclipseerStartAutoSwitch();