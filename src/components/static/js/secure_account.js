$(document).ready(function() {
    const secureToken = new URLSearchParams(window.location.search).get('secure_token');
    const csrfToken = $('#csrf_token').val();

    $('#reset-password-form').on('submit', function(event) {
        event.preventDefault();
        let formData = $(this).serialize();
        formData += '&secure_token=' + encodeURIComponent(secureToken);
        
        $.ajax({
            type: 'POST',
            url: '/account/secure_account',
            data: formData,
            headers: {
                'X-CSRFToken': csrfToken
            },
            success: function(response) {
                console.log('Success:', response.status);
                if(response.status === 'success') {
                    $('#secure_password_message').text(response.message).css('color', 'green');
                } else {
                    $('#secure_password_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                $('#secure_password_message').text('An error occurred: ' + xhr.responseJSON.message).css('color', 'red');
            }
        });
    });

    $('#security-answer-form').on('submit', function(event) {
        event.preventDefault();
        let formData = $(this).serialize();
        formData += '&secure_token=' + encodeURIComponent(secureToken);
        
        $.ajax({
            type: 'POST',
            url: '/account/secure_account',
            data: formData,
            headers: {
                'X-CSRFToken': csrfToken
            },
            success: function(response) {
                console.log('Success:', response.status);
                if(response.status === 'success' && response.show_password_form) {
                    $('#security-answer-form').css('display', 'none');
                    $('#reset-password-form').css('display', 'block');
                } else {
                    $('#secure_password_message').text(response.message).css('color', 'red');
                }
            },
            error: function(xhr, status, error) {
                $('#secure_password_message').text('An error occurred: ' + xhr.responseJSON.message).css('color', 'red');
            }
        });
    });
});