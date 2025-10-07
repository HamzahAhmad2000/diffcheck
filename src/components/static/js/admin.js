$(document).ready(function() {
    var admin_key = localStorage.getItem('admin_key');
    if (admin_key && admin_key != '') {
        var formData = new FormData();
        formData.append('key', admin_key);
        var csrf_token = $('#csrf_token').val();
        $.ajax({
            url: '/admin/verify_admin',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-CSRFToken': csrf_token,
            },
            success: function(response) {
                if (response.status === 'success') {
                    fetchDashboardData();
                    fetchQueryStatistics();
                    fetchOrganizationStatistics();
                    fetchPartnerStatistics();
                    fetchQRCodeStatistics();
                    fetchProductsStatistics();
                } else {
                    localStorage.removeItem('admin_key');
                    window.location.href = '/account';
                }
            },
            error: function(xhr) {
                localStorage.removeItem('admin_key');
                window.location.href = '/account';
            }
        });
    } else {
        localStorage.removeItem('admin_key');
        window.location.href = '/account';
    }
    

    function updatePinButton() {
        var isPinned = $('.sidebar').hasClass('unpinned');
        
        if ($(window).width() > 768) {
            $('.content').css('margin-left', isPinned ? '60px' : '200px');
        }
        else{
            $('.content').css('margin-left', '60px');
        }

        $('.pin-button i').removeClass('ri-arrow-left-s-line');
        $('.pin-button i').removeClass('ri-arrow-right-s-line');
        $('.pin-button i').addClass(isPinned ? 'ri-arrow-right-s-line' : 'ri-arrow-left-s-line');
    }

    function toggleSidebar() {
        $('.sidebar').toggleClass('unpinned');
        updatePinButton();
    }

    $('.pin-button').click(toggleSidebar);

    $('.sidebar-menu li').click(function() {
        $('.sidebar-menu li').removeClass('active');
        $(this).addClass('active');

        var sectionId = $(this).data('section');
        $('.section').removeClass('active');
        $('#' + sectionId).addClass('active');
    });

    $(window).resize(function() {
        resizeCharts();
        if ($(window).width() <= 768) {
            $('.sidebar').addClass('unpinned');
        } else {
            $('.sidebar').removeClass('unpinned');
        }
        updatePinButton();
    });

    function resizeCharts() {
        if (window.roleDistributionChart) {
            window.roleDistributionChart.resize();
        }
        if (window.verificationStatusChart) {
            window.verificationStatusChart.resize();
        }
        if (window.topCountriesChart) {
            window.topCountriesChart.resize();
        }
        if (window.userProgressChart) {
            window.userProgressChart.resize();
        }
    }

    // Initialize sidebar state based on screen size
    if ($(window).width() <= 768) {
        $('.sidebar').addClass('unpinned');
    } else {
        $('.sidebar').removeClass('unpinned');
    }

    updatePinButton();
});
function admin_logout(){
    localStorage.removeItem('admin_key');
    window.location.href = '/account';
}

function fetchDashboardData() {
    $.ajax({
        url: '/admin/dashboard_data',
        type: 'GET',
        headers: {
            'X-CSRFToken': $('#csrf_token').val(),
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            updateDashboardCards(response);
            createUserProgressChart(response.user_progress);
            createRoleDistributionChart(response.role_distribution);
            createVerificationStatusChart(response.verification_status);
            createTopCountriesChart(response.top_countries);
            createLoginActivityHeatmap(response.login_activity);
        },
        error: function(xhr) {
            console.error('Error fetching dashboard data:', xhr);
        }
    });
}
function updateDashboardCards(data) {
    $('#total-users').text(data.total_users);
    $('#active-users').text(data.active_users);
    $('#google-accounts').text(data.google_accounts);
    $('#scheduled-for-deletion-users').text(data.scheduled_for_deletion);
    $('#permanently-deleted-users').text(data.permanently_deleted);
    $('#re-registered-users').text(data.re_registered_users);
    $('#banned-users').text(data.banned_users);
    $('#restored-accounts').text(data.restored_accounts);
    $('#new-users-month').text(data.new_users_month);
    $('#deleted-users-month').text(data.deleted_users_month);
    $('#user-growth-rate').text(data.user_growth_rate + '%');
    $('#avg-user-lifetime').text(data.avg_user_lifetime + ' days');
}
function createUserProgressChart(data) {
    const ctx = document.getElementById('user-progress-chart').getContext('2d');

    // Function to generate a pastel color
    function generatePastelColor() {
        const r = Math.floor(Math.random() * 156 + 100);
        const g = Math.floor(Math.random() * 156 + 100);
        const b = Math.floor(Math.random() * 156 + 100);
        return `rgba(${r}, ${g}, ${b}, 0.6)`;
    }

    // Create gradient for New Users
    const gradientNew = ctx.createLinearGradient(0, 0, 0, 400);
    gradientNew.addColorStop(0, generatePastelColor());
    gradientNew.addColorStop(1, generatePastelColor());

    // Create gradient for Deleted Users
    const gradientDeleted = ctx.createLinearGradient(0, 0, 0, 400);
    gradientDeleted.addColorStop(0, generatePastelColor());
    gradientDeleted.addColorStop(1, generatePastelColor());

    window.userProgressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'New Users',
                    data: data.new_users,
                    borderColor: 'rgba(255, 255, 255, 1)',
                    backgroundColor: gradientNew,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Deleted Users',
                    data: data.deleted_users,
                    borderColor: 'rgba(255, 255, 255, 1)',
                    backgroundColor: gradientDeleted,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: false,
                    text: 'User Creation/Deletion Progress',
                    font: {
                        size: 18
                    }
                },
                legend: {
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 20,
                        boxHeight: 20,
                        padding: 10
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        borderDash: [5, 5]
                    }
                }
            },
            elements: {
                line: {
                    borderWidth: 2
                },
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            }
        }
    });
}
function createRoleDistributionChart(data) {
    // Generate pastel colors by making the colors lighter (closer to white)
    const pastelColors = data.labels.map(() => {
        const r = Math.floor(Math.random() * 156 + 100);
        const g = Math.floor(Math.random() * 156 + 100);
        const b = Math.floor(Math.random() * 156 + 100);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    });

    window.roleDistributionChart = new Chart($('#role-distribution-chart'), {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: pastelColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: false,
                    text: 'Role Distribution'
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 20,
                        boxHeight: 20,
                        padding: 10
                    }
                }
            },
            cutout: '50%'
        }
    });
}
function createVerificationStatusChart(data) {
    // Generate pastel colors by making the colors lighter (closer to white)
    const pastelColors = ['Verified', 'Not Verified'].map(() => {
        const r = Math.floor(Math.random() * 156 + 100);
        const g = Math.floor(Math.random() * 156 + 100);
        const b = Math.floor(Math.random() * 156 + 100);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    });

    const totalData = data.verified + data.not_verified;
    const legendDisplay = totalData > 0 ? true : false;

    window.verificationStatusChart = new Chart($('#verification-status-chart'), {
        type: 'doughnut',
        data: {
            labels: ['Verified', 'Not Verified'],
            datasets: [{
                data: [data.verified, data.not_verified],
                backgroundColor: pastelColors
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: false,
                    text: 'User Verification Status'
                },
                legend: {
                    display: legendDisplay,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 20,
                        boxHeight: 20,
                        padding: 10
                    }
                }
            },
            cutout: '50%'
        }
    });
}
function createTopCountriesChart(data) {
    // Generate pastel colors
    const pastelColors = data.labels.map(() => {
        const r = Math.floor(Math.random() * 156 + 100);
        const g = Math.floor(Math.random() * 156 + 100);
        const b = Math.floor(Math.random() * 156 + 100);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    });

    window.topCountriesChart = new Chart($('#top-countries-chart'), {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Users',
                data: data.values,
                backgroundColor: pastelColors,
                borderColor: pastelColors.map(color => color.replace('0.8', '1')), // Solid border color
                borderWidth: 1,
                borderRadius: 50,
                borderSkipped: false,
                barPercentage: 0.5, // Adjusts the width of the bar to be at most 50px
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false,
                    position: 'top',
                },
                title: {
                    display: false,
                    text: 'Top Countries by User Count',
                    font: {
                        size: 18
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        borderDash: [5, 5]
                    }
                }
            }
        }
    });
}
function createLoginActivityHeatmap(data) {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const $heatmap = $('#login-activity-heatmap');
    $heatmap.empty();

    const maxLogins = Math.max(...data.flat());
    const minLogins = Math.min(...data.flat());

    // Create heatmap container
    const $heatmapContainer = $('<div class="heatmap-container"></div>');

    // Create a grid wrapper for the heatmap grid
    const $heatmapGrid = $('<div class="heatmap-grid"></div>');

    // Add time labels to the first row of the grid
    $heatmapGrid.append('<div class="time-label"></div>'); // Placeholder for the top-left cell
    for (let hour = 0; hour < 24; hour++) {
        $heatmapGrid.append(`<div class="time-label" id="hour-${hour}">${hour.toString().padStart(2, '0')}</div>`);
    }

    // Add the heatmap cells for each day
    daysOfWeek.forEach((day, dayIndex) => {
        $heatmapGrid.append(`<div class="day-label">${day}</div>`); // Day label on the left
        for (let hour = 0; hour < 24; hour++) {
            const count = data[dayIndex][hour];
            const intensity = (count - minLogins) / (maxLogins - minLogins) || 0; // Normalized intensity
            const color = `rgba(0, 128, 0, ${intensity})`; // Color based on intensity
            $heatmapGrid.append(`<div class="heatmap-cell" style="background-color: ${color};" title="${daysOfWeek[dayIndex]} ${hour}:00 - ${count} logins"></div>`);
        }
    });

    // Append the grid to the container
    $heatmapContainer.append($heatmapGrid);
    $heatmap.append($heatmapContainer);

    // Create legend
    const $legend = $('<div class="heatmap-legend"></div>');
    const legendColors = [
        { color: 'rgba(0, 128, 0, 0)', label: minLogins.toString() },
        { color: 'rgba(0, 128, 0, 1)', label: maxLogins.toString() }
    ];
    
    $legend.append(`<div class="legend-gradient"><div style="background: linear-gradient(to right, ${legendColors[0].color}, ${legendColors[1].color});"></div></div>`);
    $legend.append(`<div class="legend-labels"><div>${legendColors[0].label}</div><div>${legendColors[1].label}</div></div>`);

    // Append the legend to the heatmap container
    $heatmap.append($legend);
}


function fetchQueryStatistics() {
    $.ajax({
        url: '/admin/get_query_statistics',
        type: 'GET',
        headers: {
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            $('#total-queries').text(response.data.total_queries);
            $('#read-queries').text(response.data.read_not_replied);
            $('#replied-queries').text(response.data.replied_queries);
        }
    });
}

function fetchOrganizationStatistics() {
    $.ajax({
        url: '/admin/get_organization_statistics',
        type: 'GET',
        headers: {
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            $('#total-organizations').text(response.data.total_organizations);
        }
    });
}

function fetchPartnerStatistics() {
    $.ajax({
        url: '/admin/get_partner_statistics',
        type: 'GET',
        headers: {
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            if (response.status === 'success') {
                $('#total-partners').text(response.data.total_partners);
            } else {
                alert('Failed to fetch partner statistics: ' + response.message);
            }
        },
        error: function() {
            alert('An error occurred while fetching partner statistics.');
        }
    });
}

function fetchQRCodeStatistics() {
    $.ajax({
        url: '/admin/get_qrcode_statistics',
        type: 'GET',
        headers: {
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            if (response.status === 'success') {
                $('#total-qrcodes').text(response.data.total_qrcodes);
                $('#active-qrcodes').text(response.data.active_qrcodes);
                $('#in-active-qrcodes').text(response.data.in_active_qrcodes);
                $('#total-visits').text(response.data.total_visits);
            } else {
                alert('Failed to fetch QR code statistics: ' + response.message);
            }
        },
        error: function() {
            alert('An error occurred while fetching QR code statistics.');
        }
    });
}


function fetchProductsStatistics() {
    $.ajax({
        url: '/admin/get_products_statistics',
        type: 'GET',
        headers: {
            'Authorization': localStorage.getItem('admin_key')
        },
        success: function(response) {
            if (response.status === 'success') {
                $('#total-products').text(response.data.total_products);
            } else {
                alert('Failed to fetch products statistics: ' + response.message);
            }
        },
        error: function() {
            alert('An error occurred while fetching products statistics.');
        }
    });
}

$(document).ready(function(){
    var userTable;

    function initializeUserTable() {
        userTable = $('#userTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_users',
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                data: function(d) {
                    d.filter = $('#userFilter').val();
                }
            },
            columns: [
                { data: 'id' },
                { data: 'name' },
                { data: 'email' },
                { data: 'role' },
                { data: 'contact_number' },
                { data: 'address' },
                { data: 'tokens_available' },
                { data: 'tokens_total' },
                { data: 'subscription_id' },
                { data: 'stripe_customer_id' },
                { data: 'created_at' },
                { data: 'last_login' },
                { 
                    data: null,
                    render: function(data, type, row) {
                        let status = [];
                        if (row.is_banned) status.push('Banned');
                        if (row.permanently_deleted) status.push('Permanently Deleted');
                        if (row.is_deleted) status.push('Scheduled for Deletion');
                        if (row.restored) status.push('Restored');
                        if (row.re_registered) status.push('Re-registered');
                        if (status.length === 0) return 'Active';
                        return status.join(', ');
                    }
                },
                {
                    data: null,
                    render: function (data, type, row) {
                        var actions = '<button class="btn btn-sm btn-primary edit-user" data-id="' + row.id + '">Edit</button> ';
                        actions += '<button class="btn btn-sm btn-info send-notification" data-id="' + row.id + '">Notify</button> ';
                        
                        if (row.is_banned) {
                            actions += '<button class="btn btn-sm btn-warning unban-user" data-id="' + row.id + '">Unban</button>';
                        } else if (row.permanently_deleted) {
                            actions += '<button class="btn btn-sm btn-success restore-user" data-id="' + row.id + '">Restore</button>';
                        } else {
                            actions += '<button class="btn btn-sm btn-danger delete-user" data-id="' + row.id + '">Delete</button> ';
                            actions += '<button class="btn btn-sm btn-warning ban-user" data-id="' + row.id + '">Ban</button>';
                        }
                        actions += '<button class="btn btn-sm btn-danger remove-user" data-id="' + row.id + '">Remove</button> ';
                        
                        return actions;
                    }
                }
            ],
            order: [[0, 'desc']]
        });

        // User filter functionality
        $('#userFilter').change(function() {
            userTable.ajax.reload();
        });

        // Edit User
        $('#userTable').on('click', '.edit-user', function () {
            var userId = $(this).data('id');
            $.ajax({
                url: '/admin/get_user/' + userId,
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function (data) {
                    $('#editUserId').val(data.id);
                    $('#editName').val(data.name);
                    $('#editEmail').val(data.email);
                    $('#editContactNumber').val(data.contact_number);
                    $('#editAddress').val(data.address);
                    $('#editRole').val(data.role);
                    $('#editTokensAvailable').val(data.tokens_available);
                    $('#editTokensTotal').val(data.tokens_total);
                    $('#editSubscriptionId').val(data.subscription_id);
                    $('#editCustomerId').val(data.stripe_customer_id);
                    $('#pfpDisplay').html(data.pfp ? "<img src='/static/pfps/" + data.pfp + "' alt='Profile Picture' width='100'>" : "No Profile Picture");
                    $('#editSecurityQuestion').val(data.security_question);
                    $('#editSecurityAnswer').val(data.security_answer);
                    $('#editUserModal').modal('show');
                    if (data.refresh_token == null) {
                        $('#refresh_token_status').text("No Refresh Token found.");
                    }
                    $('#editDeleted').val(data.is_deleted ? 'Yes' : 'No');
                    $('#editDeletedAt').val(data.deleted_at ? data.deleted_at : 'N/A');
                    $('#editReRegistered').val(data.re_registered ? 'Yes' : 'No');
                    $('#editIsBanned').val(data.is_banned ? 'Yes' : 'No');
                }
            });
        });

        $('#saveUserChanges').click(function () {
            var userData = {
                id: $('#editUserId').val(),
                name: $('#editName').val(),
                email: $('#editEmail').val(),
                contact_number: $('#editContactNumber').val(),
                address: $('#editAddress').val(),
                role: $('#editRole').val(),
                tokens_available: $('#editTokensAvailable').val(),
                tokens_total: $('#editTokensTotal').val(),
                subscription_id: $('#editSubscriptionId').val(),
                stripe_customer_id: $('#editCustomerId').val(),
                security_question: $('#editSecurityQuestion').val(),
                security_answer: $('#editSecurityAnswer').val(),
            };
            $.ajax({
                url: '/admin/update_user',
                type: 'POST',
                data: JSON.stringify(userData),
                contentType: 'application/json',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function (response) {
                    $('#editUserModal').modal('hide');
                    $('#userTable').DataTable().ajax.reload();
                    fetchDashboardData();
                }
            });
        });




        // Add User
        $('#addUserForm').submit(function (event) {
            event.preventDefault();
            var formData = new FormData(this);
            $.ajax({
                url: '/admin/add_user',
                type: 'POST',
                data: formData,
                contentType: false,
                processData: false,
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function (response) {
                    if (response.status === 'success') {
                        alert('User added successfully.');
                        $('#addUserModal').modal('hide');
                        $('#addUserForm').reset();
                        $('#userTable').DataTable().ajax.reload();
                    } else {
                        alert('Failed to add user. Please try again.');
                    }
                },
                error: function (xhr) {
                    var errorResponse = JSON.parse(xhr.responseText);
                    alert('Error adding user: ' + errorResponse.message);
                }
            });
        });

        // Remove Profile Picture
        $('#removePfp').click(function () {
            var userId = $('#editUserId').val();
            $.ajax({
                url: '/admin/remove_pfp',
                type: 'POST',
                data: JSON.stringify({ id: userId }),
                contentType: 'application/json',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function (response) {
                    $('#pfpDisplay').empty();
                    $('#pfpDisplay').text(response.message);
                },
                error: function (xhr) {
                    var errorResponse = JSON.parse(xhr.responseText);
                    $('#pfpDisplay').empty();
                    $('#pfpDisplay').text(errorResponse.message);
                }
            });
        });

        // Delete Refresh Token
        $('#deleteRefreshToken').click(function () {
            var userId = $('#editUserId').val();
            $.ajax({
                url: '/admin/delete_refresh_token',
                type: 'POST',
                data: JSON.stringify({ id: userId }),
                contentType: 'application/json',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function (response) {
                    $('#refresh_token_status').text(response.message);
                },
                error: function (xhr) {
                    $('#refresh_token_status').text(JSON.parse(xhr.responseText).message);
                }
            });
        });


        // Delete User
        $('#userTable').on('click', '.delete-user', function() {
            var userId = $(this).data('id');
            if (confirm('Are you sure you want to delete this user?')) {
                $.ajax({
                    url: '/admin/delete_user/' + userId,
                    type: 'DELETE',
                    headers: {
                        'X-CSRFToken': $('#csrf_token').val(),
                        'Authorization': localStorage.getItem('admin_key')
                    },
                    success: function(response) {
                        userTable.ajax.reload();
                        fetchDashboardData();
                    }
                });
            }
        });

        // Ban User
        var banQuill = new Quill('#banReason', {
            theme: 'snow'
        });

        $('#userTable').on('click', '.ban-user', function() {
            var userId = $(this).data('id');
            $('#banUserId').val(userId);
            banQuill.setText('');
            $('#banUserModal').modal('show');
        });

        $('#confirmBan').click(function() {
            var userId = $('#banUserId').val();
            var reason = banQuill.root.innerHTML;
            $.ajax({
                url: '/admin/ban_user',
                type: 'POST',
                data: JSON.stringify({ id: userId, reason: reason }),
                contentType: 'application/json',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    $('#banUserModal').modal('hide');
                    userTable.ajax.reload();
                    fetchDashboardData();
                }
            });
        });

        // Unban User
        $('#userTable').on('click', '.unban-user', function() {
            var userId = $(this).data('id');
            if (confirm('Are you sure you want to unban this user?')) {
                $.ajax({
                    url: '/admin/unban_user/' + userId,
                    type: 'POST',
                    headers: {
                        'X-CSRFToken': $('#csrf_token').val(),
                        'Authorization': localStorage.getItem('admin_key')
                    },
                    success: function(response) {
                        userTable.ajax.reload();
                        fetchDashboardData();
                    }
                });
            }
        });

        // Restore User
        $('#userTable').on('click', '.restore-user', function() {
            var userId = $(this).data('id');
            if (confirm('Are you sure you want to restore this user?')) {
                $.ajax({
                    url: '/admin/restore_user/' + userId,
                    type: 'POST',
                    headers: {
                        'X-CSRFToken': $('#csrf_token').val(),
                        'Authorization': localStorage.getItem('admin_key')
                    },
                    success: function(response) {
                        userTable.ajax.reload();
                        fetchDashboardData();
                    }
                });
            }
        });
        
        $('#userTable').on('click', '.remove-user', function() {
            var userId = $(this).data('id');
            $.ajax({
                url: '/admin/remove_user/' + userId,
                type: 'POST',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    userTable.ajax.reload();
                    fetchDashboardData();
                }
            });
        });

        // Send Notification
        var notificationQuill = new Quill('#notificationMessage', {
            theme: 'snow'
        });

        $('#userTable').on('click', '.send-notification', function() {
            var userId = $(this).data('id');
            $('#notificationUserId').val(userId);
            $('#notificationSubject').val('');
            notificationQuill.setText('');
            $('#sendNotificationModal').modal('show');
        });

        $('#sendNotification').click(function() {
            var userId = $('#notificationUserId').val();
            var subject = $('#notificationSubject').val();
            var message = notificationQuill.root.innerHTML;
            $.ajax({
                url: '/admin/send_notification',
                type: 'POST',
                data: JSON.stringify({ id: userId, subject: subject, message: message }),
                contentType: 'application/json',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    $('#sendNotificationModal').modal('hide');
                    userTable.ajax.reload();
                },
                error: function(xhr, status, error) {
                    var errorMessage = xhr.responseJSON.message;
                    $('#notify_error').text(errorMessage);
                }
            });
        });
    }

    // Initialize the DataTable
    initializeUserTable();

    // Export Data
    $('#exportCSV').click(function() {
        window.location.href = '/admin/export_users/csv?Authorization=' + localStorage.getItem('admin_key');
    });

    $('#exportExcel').click(function() {
        window.location.href = '/admin/export_users/excel?Authorization=' + localStorage.getItem('admin_key');
    });











    var quill = new Quill('#quillEditor', {
        theme: 'snow'
    });
    var queriesTable;
    function initializeQueriesTable() {
        // Initialize DataTable
        queriesTable = $('#queriesTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_queries',
                type: 'GET',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                }
            },
            columns: [
                { data: 'id' },
                { data: 'name' },
                { data: 'email' },
                { data: 'query_text' },
                { data: 'reply_text', render: function(data) { return data ? data : 'No reply yet'; } },
                { data: 'is_read', render: function(data) { return data ? 'Yes' : 'No'; } },
                {
                    data: null,
                    render: function(data, type, row) {
                        let actions = '';
                        if (row.reply_text === null || row.reply_text === '') {
                            actions += '<button class="btn btn-sm btn-primary reply-query" data-id="' + row.id + '">Reply</button> ';
                        }
                        if (!row.is_read) {
                            actions += '<button class="btn btn-sm btn-info mark-read" data-id="' + row.id + '">Mark as Read</button> ';
                        }
                        actions += '<button class="btn btn-sm btn-danger remove-query" data-id="' + row.id + '">Remove</button>';
                        return actions;
                    }
                }
            ],
            order: [[0, 'desc']],
            dom: 'Bfrtip',
            // buttons: [
            //     'csv', 'excel'
            // ],
            pageLength: 10,
            language: {
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "Showing 0 to 0 of 0 entries",
                emptyTable: "No data available in table"
            },
            lengthMenu: [5, 10, 25, 50]
        });

        // Add event listeners for actions
        $('#queriesTable').on('click', '.reply-query', function() {
            var queryId = $(this).data('id');
            $('#replyQueryId').val(queryId);
            $('#replyModal').modal('show');
        });

        // Send Reply
        $('#sendReply').click(function() {
            var queryId = $('#replyQueryId').val();
            var subject = $('#replySubject').val();
            var message = quill.root.innerHTML;  // Get message from Quill editor

            var replyData = {
                id: queryId,
                subject: subject,
                message: message
            };

            $.ajax({
                url: '/admin/send_reply',
                type: 'POST',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key'),
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify(replyData),
                success: function(response) {
                    $('#replyModal').modal('hide');
                    queriesTable.ajax.reload();
                    fetchQueryStatistics();  // Update statistics
                }
            });
        });

        // Action: Mark as read
        $('#queriesTable').on('click', '.mark-read', function() {
            var queryId = $(this).data('id');
            $.ajax({
                url: '/admin/mark_as_read/' + queryId,
                type: 'POST',
                headers: {
                    'X-CSRFToken': $('#csrf_token').val(),
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    queriesTable.ajax.reload();
                    fetchQueryStatistics();  // Update statistics
                }
            });
        });

        // Action: Remove query
        $('#queriesTable').on('click', '.remove-query', function() {
            var queryId = $(this).data('id');
            if (confirm('Are you sure you want to remove this query?')) {
                $.ajax({
                    url: '/admin/remove_query/' + queryId,
                    type: 'DELETE',
                    headers: {
                        'X-CSRFToken': $('#csrf_token').val(),
                        'Authorization': localStorage.getItem('admin_key')
                    },
                    success: function(response) {
                        queriesTable.ajax.reload();
                        fetchQueryStatistics();  // Update statistics
                    }
                });
            }
        });
    };

    initializeQueriesTable();








    var organizationsTable;

    function initializeOrganizationsTable() {
        organizationsTable = $('#organizationsTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_organizations',
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                }
            },
            columns: [
                { data: 'id' },
                { data: 'name' },
                { data: 'title' },
                { data: 'description' },
                { data: 'contact_number' },
                { data: 'partners' },
                { 
                    data: 'image',
                    render: function(data) {
                        return data ? '<img src="' + data + '" width="50" height="50">' : 'No image';
                    }
                },
                { 
                    data: 'location_link',
                    render: function(data) {
                        return data ? '<button class="btn btn-primary btn-sm" onclick="window.open(\'' + data + '\', \'_blank\')"><i class="ri-link"></i></button>' : 'No link';
                    }
                },
                { data: 'lat' },
                { data: 'long' },
                {
                    data: null,
                    render: function(data, type, row) {
                        return '<button class="btn btn-primary btn-sm edit-org" data-id="' + row.id + '">Edit</button> ' +
                               '<button class="btn btn-danger btn-sm remove-org" data-id="' + row.id + '">Remove</button>';
                    }
                }
            ],
            order: [[0, 'desc']],
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            pageLength: 10,
            dom: 'lBfrtip',
            language: {
                lengthMenu: "Show _MENU_ entries per page",
                info: "Showing _START_ to _END_ of _TOTAL_ entries",
                infoEmpty: "Showing 0 to 0 of 0 entries",
                infoFiltered: "(filtered from _MAX_ total entries)"
            }
        });



        // Add Organization
        $('#addOrganization').click(function() {
            $('#addOrganizationModal').modal('show');
        });

        // Add Organization
        $('#addOrganizationForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            
            $.ajax({
                url: '/admin/add_organization',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#addOrganizationModal').modal('hide');
                        organizationsTable.ajax.reload();
                        fetchOrganizationStatistics();
                    } else {
                        alert('Failed to add organization: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while adding the organization.');
                }
            });
        });

        // Edit Organization
        $('#organizationsTable').on('click', '.edit-org', function() {
            var organizationId = $(this).data('id');
            $.ajax({
                url: '/admin/get_organization/' + organizationId,
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    if (response.status === 'success') {
                        var org = response.data;
                        $('#orgEditOrganizationId').val(org.id);
                        $('#orgEditName').val(org.name);
                        $('#orgEditTitle').val(org.title);
                        $('#orgEditDescription').val(org.description);
                        $('#orgEditContactNumber').val(org.contact_number);
                        $('#orgEditLocationLink').val(org.location_link);
                        $('#orgEditLatitude').val(org.lat);
                        $('#orgEditLongitude').val(org.long);
                        
                        // Handle image display
                        if (org.image) {
                            $('#orgCurrentImage').attr('src', org.image);
                            $('#orgCurrentImageContainer').show();
                        } else {
                            $('#orgCurrentImageContainer').hide();
                        }
                        $('#editOrganizationModal').modal('show');
                    } else {
                        alert('Failed to fetch organization details: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while fetching organization details.');
                }
            });
        });

        $('#editOrganizationForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            var organizationId = $('#orgEditOrganizationId').val();
            
            $.ajax({
                url: '/admin/update_organization/' + organizationId,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#editOrganizationModal').modal('hide');
                        organizationsTable.ajax.reload();
                        fetchOrganizationStatistics();
                    } else {
                        alert('Failed to update organization: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while updating the organization.');
                }
            });
        });


        // Remove Organization
        $('#organizationsTable').on('click', '.remove-org', function() {
            var organizationId = $(this).data('id');
            if (confirm('Are you sure you want to remove this organization?')) {
                $.ajax({
                    url: '/admin/remove_organization/' + organizationId,
                    type: 'DELETE',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key'),
                        'X-CSRFToken': $('#csrf_token').val(),
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            organizationsTable.ajax.reload();
                            fetchOrganizationStatistics();
                        } else {
                            alert('Failed to remove organization: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('An error occurred while removing the organization.');
                    }
                });
            }
        });
    }

    initializeOrganizationsTable();








    var partnersTable;

    function initializePartnersTable() {
        partnersTable = $('#partnersTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_partners',
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                }
            },
            columns: [
                { data: 'id' },
                { data: 'name' },
                { data: 'email' },
                { 
                    data: 'password',
                    render: function(data, type, row) {
                        return '<span class="password-blur" data-id="' + row.id + '">' + data + '</span>';
                    }
                },
                { data: 'contact_number' },
                { data: 'address' },
                { data: 'shipping_address' },
                { data: 'organization_name' },
                {
                    data: null,
                    render: function(data, type, row) {
                        return '<button  class="btn btn-primary btn-sm edit-partner" data-id="' + row.id + '">Edit</button> ' +
                               '<button class="btn btn-danger btn-sm remove-partner" data-id="' + row.id + '">Remove</button>';
                    }
                }
            ],
            order: [[0, 'desc']],
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            pageLength: 10
        });
    
        // Add Partner
        $('#addPartner').click(function() {
            loadOrganizationsDropdown('#partnerAddOrganization');
            $('#addPartnerModal').modal('show');
        });
    
        // Add Partner Form Submission
        $('#addPartnerForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            
            $.ajax({
                url: '/admin/add_partner',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#addPartnerModal').modal('hide');
                        partnersTable.ajax.reload();
                        fetchPartnerStatistics();
                        loadPartnersDropdown('#assignPartnerDropdown');
                        loadPartnersDropdown('#downloadForDropdown');
                    } else {
                        alert('Failed to add partner: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while adding the partner.');
                }
            });
        });
    
        // Edit Partner
        $('#partnersTable').on('click', '.edit-partner', function() {
            var partnerId = $(this).data('id');
            $.ajax({
                url: '/admin/get_partner/' + partnerId,
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    if (response.status === 'success') {
                        var partner = response.data;
                        $('#partnerEditPartnerId').val(partner.id);
                        $('#partnerEditName').val(partner.name);
                        $('#partnerEditEmail').val(partner.email);
                        $('#partnerEditContactNumber').val(partner.contact_number);
                        $('#partnerEditAddress').val(partner.address);
                        $('#partnerEditShippingAddress').val(partner.shipping_address);
                        loadOrganizationsDropdown('#partnerEditOrganization', partner.organization_id);
                        $('#editPartnerModal').modal('show');
                    } else {
                        alert('Failed to fetch partner details: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while fetching partner details.');
                }
            });
        });
    
        // Edit Partner Form Submission
        $('#editPartnerForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            var partnerId = $('#partnerEditPartnerId').val();
            
            $.ajax({
                url: '/admin/update_partner/' + partnerId,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#editPartnerModal').modal('hide');
                        partnersTable.ajax.reload();
                        fetchPartnerStatistics();
                        loadPartnersDropdown('#assignPartnerDropdown');
                    } else {
                        alert('Failed to update partner: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while updating the partner.');
                }
            });
        });
    
        // Remove Partner
        $('#partnersTable').on('click', '.remove-partner', function() {
            var partnerId = $(this).data('id');
            if (confirm('Are you sure you want to remove this partner?')) {
                $.ajax({
                    url: '/admin/remove_partner/' + partnerId,
                    type: 'DELETE',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key'),
                        'X-CSRFToken': $('#csrf_token').val(),
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            partnersTable.ajax.reload();
                            fetchPartnerStatistics();
                            loadPartnersDropdown('#assignPartnerDropdown');
                        } else {
                            alert('Failed to remove partner: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('An error occurred while removing the partner.');
                    }
                });
            }
        });

        // Password reveal functionality
        $('#partnersTable').on('click', '.password-blur', function() {
            var $this = $(this);
            var partnerId = $this.data('id');
            
            if (!$this.data('revealed')) {
                $.ajax({
                    url: '/admin/get_partner_password/' + partnerId,
                    type: 'GET',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key')
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            $this.text(response.data.password);
                            $this.data('revealed', true);
                            $this.removeClass('password-blur');
                            setTimeout(function() {
                                $this.text('••••••••');
                                $this.addClass('password-blur');
                                $this.data('revealed', false);
                            }, 5000); // Hide password after 5 seconds
                        } else {
                            alert('Failed to fetch partner password: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('An error occurred while fetching partner password.');
                    }
                });
            }
        });
    }

    initializePartnersTable();

    function loadOrganizationsDropdown(selectElement, selectedId) {
        $.ajax({
            url: '/admin/get_organizations_for_dropdown',
            type: 'GET',
            headers: {
                'Authorization': localStorage.getItem('admin_key')
            },
            success: function(response) {
                if (response.status === 'success') {
                    var select = $(selectElement);
                    select.empty();
                    select.append('<option value="">Select an organization</option>');
                    $.each(response.data, function(i, org) {
                        select.append($('<option></option>').attr('value', org.id).text(org.name));
                    });
                    if (selectedId) {
                        select.val(selectedId);
                    }
                } else {
                    alert('Failed to load organizations: ' + response.message);
                }
            },
            error: function() {
                alert('An error occurred while loading organizations.');
            }
        });
    }

    $('<style>')
        .prop('type', 'text/css')
        .html(`
            .password-blur {
                filter: blur(4px);
                transition: filter 0.3s ease;
                cursor: pointer;
            }
            .password-blur:hover {
                filter: blur(2px);
            }
    `).appendTo('head');










    var qrcodesTable;

    function initializeQRCodesTable() {
        qrcodesTable = $('#qrcodesTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_qrcodes',
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                }
            },
            columns: [
                {
                    data: null,
                    render: function (data, type, row) {
                        return '<input type="checkbox" class="qrcode-select" data-id="' + row.id + '">';
                    },
                    orderable: false
                },
                { data: 'id' },
                { data: 'url' },
                { data: 'partner_name' },
                { data: 'partner_email' },
                { data: 'deceased_name' },
                { 
                    data: 'is_active',
                    render: function(data) {
                        return data ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>';
                    }
                },
                { data: 'visit_count' },
                { 
                    data: 'last_visit',
                    render: function(data) {
                        return data ? new Date(data).toLocaleString() : 'Never';
                    }
                },
                { 
                    data: 'qr_image',
                    render: function(data) {
                        return data ? '<img src="' + data + '" width="50" height="50">' : 'No image';
                    }
                },
                {
                    data: null,
                    render: function(data, type, row) {
                        return '<button class="btn btn-primary btn-sm edit-qrcode" data-id="' + row.id + '">Edit</button> ' +
                               '<button class="btn btn-danger btn-sm remove-qrcode" data-id="' + row.id + '">Remove</button>';
                    }
                }
            ],
            order: [[1, 'desc']],
            lengthMenu: [[10, 25, 50, 100], [10, 25, 50, 100]],
            pageLength: 10
        });
    
       // Add QR Code
        $('#addQRCode').click(function() {
            loadPartnersDropdown('#qrcodeAddPartner');
            $('#addQRCodeModal').modal('show');
        });

        // Add QR Code Form Submission
        $('#addQRCodeForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            
            $.ajax({
                url: '/admin/add_qrcode',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#addQRCodeModal').modal('hide');
                        qrcodesTable.ajax.reload();
                        fetchQRCodeStatistics();
                    } else {
                        alert('Failed to add QR code: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while adding the QR code.');
                }
            });
        });

        // Edit QR Code
        $('#qrcodesTable').on('click', '.edit-qrcode', function() {
            var qrcodeId = $(this).data('id');
            $.ajax({
                url: '/admin/get_qrcode/' + qrcodeId,
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    if (response.status === 'success') {
                        var qrcode = response.data;
                        $('#qrcodeEditQRCodeId').val(qrcode.id);
                        $('#qrcodeEditURL').val(qrcode.url);
                        loadPartnersDropdown('#qrcodeEditPartner', qrcode.partner_id);
                        $('#editQRCodeModal').modal('show');
                    } else {
                        alert('Failed to fetch QR code details: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while fetching QR code details.');
                }
            });
        });

        // Edit QR Code Form Submission
        $('#editQRCodeForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            var qrcodeId = $('#qrcodeEditQRCodeId').val();
            
            $.ajax({
                url: '/admin/update_qrcode/' + qrcodeId,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#editQRCodeModal').modal('hide');
                        qrcodesTable.ajax.reload();
                        fetchQRCodeStatistics();
                    } else {
                        alert('Failed to update QR code: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while updating the QR code.');
                }
            });
        });
        // Remove QR Code
        $('#qrcodesTable').on('click', '.remove-qrcode', function() {
            var qrcodeId = $(this).data('id');
            if (confirm('Are you sure you want to remove this QR code?')) {
                $.ajax({
                    url: '/admin/delete_qrcodes',
                    type: 'POST',
                    data: JSON.stringify({ qrcode_ids: [qrcodeId] }),
                    contentType: 'application/json',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key'),
                        'X-CSRFToken': $('#csrf_token').val(),
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            qrcodesTable.ajax.reload();
                            fetchQRCodeStatistics();
                        } else {
                            alert('Failed to remove QR code: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('An error occurred while removing the QR code.');
                    }
                });
            }
        });

        // Bulk Generate QR Codes
        $('#bulkGenerateQRCodes').click(function() {
            loadPartnersDropdown('#bulkqrcodeAddPartner');
            $('#bulkGenerateQRCodesModal').modal('show');
        });

        $('#bulkGenerateQRCodesForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            
            $.ajax({
                url: '/admin/bulk_generate_qrcodes',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#bulkGenerateQRCodesModal').modal('hide');
                        qrcodesTable.ajax.reload();
                        fetchQRCodeStatistics();
                        alert(response.message);
                    } else {
                        alert('Failed to generate QR codes: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while generating QR codes.');
                }
            });
        });

        // Select All QR Codes
        $('#selectAllQRCodes').change(function() {
            $('.qrcode-select').prop('checked', this.checked);
            updateBulkActionButtons();
        });
        // Individual QR Code Selection
        $('#qrcodesTable').on('change', '.qrcode-select', function() {
            updateBulkActionButtons();
        });

        // Delete Selected QR Codes
        $('#deleteSelectedQRCodes').click(function() {
            var selectedIds = $('.qrcode-select:checked').map(function() {
                return $(this).data('id');
            }).get();

            if (selectedIds.length === 0) {
                alert('Please select at least one QR code to delete.');
                return;
            }

            if (confirm('Are you sure you want to delete the selected QR codes?')) {
                $.ajax({
                    url: '/admin/delete_qrcodes',
                    type: 'POST',
                    data: JSON.stringify({ qrcode_ids: selectedIds }),
                    contentType: 'application/json',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key'),
                        'X-CSRFToken': $('#csrf_token').val(),
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            qrcodesTable.ajax.reload();
                            fetchQRCodeStatistics();
                            $('#deleteSelectedQRCodes').css('display','none');
                            $('#assignPartnerDropdown').css('display','none');
                            alert(response.message);
                        } else {
                            $('#deleteSelectedQRCodes').css('display','none');
                            $('#assignPartnerDropdown').css('display','none');
                            alert('Failed to delete QR codes: ' + response.message);
                        }
                    },
                    error: function() {
                        $('#deleteSelectedQRCodes').css('display','none');
                        $('#assignPartnerDropdown').css('display','none');
                        alert('An error occurred while deleting QR codes.');
                    }
                });
            }
        });

        // Assign Partner to Selected QR Codes
        $('#assignPartnerDropdown').change(function() {
            var partnerId = $(this).val();
            if (!partnerId) return;

            var selectedIds = $('.qrcode-select:checked').map(function() {
                return $(this).data('id');
            }).get();

            if (selectedIds.length === 0) {
                alert('Please select at least one QR code to assign a partner.');
                return;
            }

            $.ajax({
                url: '/admin/assign_partner',
                type: 'POST',
                data: JSON.stringify({ qrcode_ids: selectedIds, partner_id: partnerId }),
                contentType: 'application/json',
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        qrcodesTable.ajax.reload();
                        $('#deleteSelectedQRCodes').css('display','none');
                        $('#assignPartnerDropdown').css('display','none');
                        alert(response.message);
                    } else {
                        $('#deleteSelectedQRCodes').css('display','none');
                        $('#assignPartnerDropdown').css('display','none');
                        alert('Failed to assign partner: ' + response.message);
                    }
                },
                error: function() {
                    $('#deleteSelectedQRCodes').css('display','none');
                    $('#assignPartnerDropdown').css('display','none');
                    alert('An error occurred while assigning partner.');
                }
            });
        });

    }
    initializeQRCodesTable();

    function updateBulkActionButtons() {
        var anySelected = $('.qrcode-select:checked').length > 0;
        $('#deleteSelectedQRCodes').toggle(anySelected);
        $('#assignPartnerDropdown').toggle(anySelected);
    }
    
    function loadPartnersDropdown(selectElement, selectedId) {
        $.ajax({
            url: '/admin/get_partners_for_dropdown',
            type: 'GET',
            headers: {
                'Authorization': localStorage.getItem('admin_key')
            },
            success: function(response) {
                if (response.status === 'success') {
                    var select = $(selectElement);
                    select.empty();
                    select.append('<option value="">Select a partner</option>');
                    $.each(response.data, function(i, partner) {
                        select.append($('<option></option>').attr('value', partner.id).text(partner.name + ' (' + partner.email + ')'));
                    });
                    if (selectedId) {
                        select.val(selectedId);
                    }                    
                } else {
                    alert('Failed to load partners: ' + response.message);
                }
            },
            error: function() {
                alert('An error occurred while loading partners.');
            }
        });
    }

    loadPartnersDropdown('#assignPartnerDropdown');
    loadPartnersDropdown('#downloadForDropdown');

    // Enable/disable Download Selected button based on checkbox selection
    $('#qrcodesTable').on('change', '.qrcode-select', function () {
        $('#downloadSelected').prop('disabled', $('.qrcode-select:checked').length === 0);
    });

    // Download for selected partner or all
    $('#downloadForDropdown').change(function () {
        var selectedValue = $(this).val();
        if (selectedValue) {
            var url = '/admin/export_qrcodes/excel?partner_id=' + (selectedValue === 'all' ? '' : selectedValue);
            downloadCSV(url);
        }
    });

    // Download selected QR codes
    $('#downloadSelected').click(function () {
        var selectedIds = $('.qrcode-select:checked').map(function () {
            return $(this).data('id');
        }).get();

        if (selectedIds.length > 0) {
            var url = '/admin/export_qrcodes/excel?qrcode_ids=' + selectedIds.join(',');
            downloadCSV(url);
        }
    });

    $('#downloadAll').click(function () {
        var url = '/admin/export_qrcodes/excel?download_all=true';
        downloadCSV(url);
    });

    $('#downloadUnassigned').click(function () {
        var url = '/admin/export_qrcodes/excel?download_unassigned=true';
        downloadCSV(url);
    });

    function downloadCSV(url) {
        $.ajax({
            url: url,
            type: 'GET',
            headers: {
                'Authorization': localStorage.getItem('admin_key'),
                'X-CSRFToken': $('#csrf_token').val()
            },
            xhrFields: {
                responseType: 'blob'
            },
            success: function (blob) {
                var link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = 'qrcodes.csv';
                link.click();
            },
            error: function (xhr, status, error) {
                console.error('Error downloading CSV:', error);
                alert('An error occurred while downloading the CSV file.');
            }
        });
    }



    var productsTable;

    function initializeProductsTable() {
        productsTable = $('#productsTable').DataTable({
            processing: true,
            serverSide: true,
            ajax: {
                url: '/admin/get_all_products',
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                }
            },
            columns: [
                { data: 'id' },
                { data: 'name' },
                { data: 'description' },
                { data: 'price' },
                { data: 'supplier_name' },
                { data: 'supplier_email' },
                { data: 'supplier_number' },
                { 
                    data: null,
                    render: function(data, type, row) {
                        return '<button class="btn btn-sm btn-primary edit-product" data-id="' + row.id + '">Edit</button> ' +
                               '<button class="btn btn-sm btn-danger delete-product" data-id="' + row.id + '">Delete</button>';
                    }
                }
            ],
            order: [[0, 'asc']]
        });


        // Add Image button click handler for Add Product modal
        $('#addImageBtn').click(function() {
            var imageInput = $('<input type="file" name="images[]" accept="image/*" class="form-control mt-2">');
            var removeBtn = $('<button type="button" class="btn btn-danger btn-sm mt-1">Remove</button>');
            var imageContainer = $('<div class="image-input-container mb-2"></div>').append(imageInput).append(removeBtn);
            $('#imageContainer').append(imageContainer);

            removeBtn.click(function() {
                $(this).parent().remove();
            });
        });

        // Add Image button click handler for Edit Product modal
        $('#editAddImageBtn').click(function() {
            var imageInput = $('<input type="file" name="new_images[]" accept="image/*" class="form-control mt-2">');
            var removeBtn = $('<button type="button" class="btn btn-danger btn-sm mt-1">Remove</button>');
            var imageContainer = $('<div class="image-input-container mb-2"></div>').append(imageInput).append(removeBtn);
            $('#editImageContainer').append(imageContainer);

            removeBtn.click(function() {
                $(this).parent().remove();
            });
        });

        // Add Product
        $('#addProductForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);


            // Log the form data for debugging
            for (var pair of formData.entries()) {
                if(pair[1] instanceof File) {
                    console.log(pair[0] + ', ' + pair[1].name + ', ' + pair[1].size + ' bytes'); // Log file details
                } else {
                    console.log(pair[0] + ', ' + pair[1]);
                }
            }

            
            $.ajax({
                url: '/admin/add_product',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#addProductModal').modal('hide');
                        productsTable.ajax.reload();
                        fetchProductsStatistics();
                    } else {
                        alert('Failed to add product: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while adding the product.');
                }
            });
        });

        // Edit Product
        $('#productsTable').on('click', '.edit-product', function() {
            var productId = $(this).data('id');
            $.ajax({
                url: '/admin/get_product/' + productId,
                type: 'GET',
                headers: {
                    'Authorization': localStorage.getItem('admin_key')
                },
                success: function(response) {
                    if (response.status === 'success') {
                        var product = response.data;
                        $('#editProductId').val(product.id);
                        $('#editProductName').val(product.name);
                        $('#editProductDescription').val(product.description);
                        $('#editProductPrice').val(product.price);
                        $('#editSupplierName').val(product.supplier_name);
                        $('#editSupplierEmail').val(product.supplier_email);
                        $('#editSupplierNumber').val(product.supplier_number);
                        
                        // Display existing images
                        var imagesHtml = '';
                        product.images.forEach(function(image, index) {
                            imagesHtml += '<div class="mb-2">';
                            imagesHtml += '<img src="' + image + '" alt="Product Image" style="max-width: 100px; max-height: 100px;">';
                            imagesHtml += '<button type="button" class="btn btn-danger btn-sm mt-1 remove-existing-image" data-image-id="' + product.image_ids[index] + '">Remove</button>';
                            imagesHtml += '</div>';
                        });
                        $('#existingImages').html(imagesHtml);
                        
                        $('#editProductModal').modal('show');
                    } else {
                        alert('Failed to load product data: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while loading product data.');
                }
            });
        });

        // Update Product
        $('#editProductForm').submit(function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            var productId = $('#editProductId').val();
            
            $.ajax({
                url: '/admin/update_product/' + productId,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        $('#editProductModal').modal('hide');
                        productsTable.ajax.reload();
                        fetchProductsStatistics();
                    } else {
                        alert('Failed to update product: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while updating the product.');
                }
            });
        });

        // Remove existing image
        $('#existingImages').on('click', '.remove-existing-image', function() {
            var imageId = $(this).attr('data-image-id');
            var imageContainer = $(this).parent();
            
            $.ajax({
                url: '/admin/remove_product_image/' + imageId,
                type: 'DELETE',
                headers: {
                    'Authorization': localStorage.getItem('admin_key'),
                    'X-CSRFToken': $('#csrf_token').val(),
                },
                success: function(response) {
                    if (response.status === 'success') {
                        imageContainer.remove();
                    } else {
                        alert('Failed to remove image: ' + response.message);
                    }
                },
                error: function() {
                    alert('An error occurred while removing the image.');
                }
            });
        });

        // Delete Product
        $('#productsTable').on('click', '.delete-product', function() {
            var productId = $(this).data('id');
            if (confirm('Are you sure you want to delete this product?')) {
                $.ajax({
                    url: '/admin/delete_product/' + productId,
                    type: 'DELETE',
                    headers: {
                        'Authorization': localStorage.getItem('admin_key'),
                        'X-CSRFToken': $('#csrf_token').val(),
                    },
                    success: function(response) {
                        if (response.status === 'success') {
                            productsTable.ajax.reload();
                            fetchProductsStatistics();
                        } else {
                            alert('Failed to delete product: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('An error occurred while deleting the product.');
                    }
                });
            }
        });
    }

    initializeProductsTable();

});
