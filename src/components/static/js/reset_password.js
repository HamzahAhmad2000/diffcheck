$(document).ready(function() {
    const csrfToken = $('#csrf_token').val();

    
    $('#resetPasswordForm').on('submit', function(event) {
        event.preventDefault();
        const formData = $(this).serialize();
        const resetToken = window.location.pathname.split('/').pop();

        if (!$('#password').val() || !$('#confirmPassword').val()) {
            $('#reset_password_message').text('Please enter both password and confirm password.').css('color', 'red');
            return;
        }

        if ($('#password').val() !== $('#confirmPassword').val()) {
            $('#reset_password_message').text('Passwords do not match.').css('color', 'red');
            return;
        }

        $.ajax({
            url: '/account/reset_password/' + resetToken,
            type: 'POST',
            data: formData,
            headers: {
                'X-CSRFToken': csrfToken
            },
            success: function(response) {
                console.log(response);
                $('#reset_password_message').text(response.message).css('color', 'green');
                // do something in case of success
            },
            error: function(xhr) {
                console.log(xhr);
                $('#reset_password_message').text('Error: ' + xhr.responseJSON.message).css('color', 'red');
            }
        });
    });

});