let currentUserId = null;
let currentDeceasedProfileId = null;

$(document).ready(function() {
    // Show Add User form by default
    $('#add-user-section').show();
    $('#user-table-section').hide();

    // Handle navigation
    $('#add-user-link').click(function(e) {
        e.preventDefault();
        $('#add-user-section').show();
        $('#user-table-section').hide();
        $('#qr-codes-section').hide();
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
    });



    $('#user-table-link').click(function(e) {
        e.preventDefault();
        $('#add-user-section').hide();
        $('#qr-codes-section').hide();
        $('#user-table-section').show();
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        $('#logout-btn').show();
    });

    // Initialize DataTable for users table
    $('#usersTable').DataTable();
    
    
    const partnerToken = localStorage.getItem('partner_token');
    if (partnerToken && partnerToken !== '') {
        verifyPartner(partnerToken);
    } else {
        redirectToAccount();
    }
    
    $('#addUserForm').submit(handleAddUser);
    
    $('#logout-btn').on('click', redirectToAccount);

    // Handle QR Codes section
    $('#qr-codes-link').click(function(e) {
        e.preventDefault();
        $('#qr-codes-section').show();
        $('#add-user-section, #user-table-section').hide();
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        loadQRCodes();
    });

    // Load QR Codes
    function loadQRCodes(page = 1, search = '') {
        $.ajax({
            url: '/partner/get_qr_codes',
            method: 'GET',
            data: { page: page, search: search },
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
                'X-CSRFToken': $('#csrf_token').val(),
            },
            success: function(data) {
                if (data.status === 'success') {
                    populateQRCodesTable(data.qr_codes);
                    setupPagination(data.total_pages, page);
                } else {
                    alert('Failed to load QR codes. Please try again.');
                }
            },
            error: function(error) {
                console.error('Error loading QR codes:', error);
            },
        });
    }

    // Populate QR Codes Table
    function populateQRCodesTable(qrCodes) {
        const tableBody = $('#qrCodesTable tbody');
        tableBody.empty();
        qrCodes.forEach(qr => {
            tableBody.append(`
                <tr>
                    <td>${qr.id}</td>
                    <td>${qr.url}</td>
                    <td>${qr.deceased_name}</td>
                    <td>${qr.is_active ? 'Yes' : 'No'}</td>
                    <td><img src="${qr.qr_image}" alt="QR Code" style="max-width: 100px;"></td>
                    <td>${new Date(qr.created_at).toLocaleString()}</td>
                </tr>
            `);
        });
    }

    // Setup Pagination
    function setupPagination(totalPages, currentPage) {
        const pagination = $('#pagination');
        pagination.empty();
        for (let i = 1; i <= totalPages; i++) {
            const pageLink = $('<a>').text(i).attr('href', '#').addClass('page-link');
            if (i === currentPage) {
                pageLink.addClass('active');
            }
            pageLink.click(function(e) {
                e.preventDefault();
                loadQRCodes(i, $('#qr-search').val());
            });
            pagination.append(pageLink);
        }
    }

    // Search QR Codes
    $('#qr-search').on('input', function() {
        const searchValue = $(this).val();
        loadQRCodes(1, searchValue);
    });
});

function verifyPartner(partnerToken) {
    const formData = new FormData();
    const csrfToken = $('#csrf_token').val();
    $.ajax({
        url: '/partner/verify_partner',
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        headers: {
            'Authorization': `Bearer ${partnerToken}`,
            'X-CSRFToken': csrfToken,
        },
        success: function(data) {
            if (data.status !== 'success') {
                redirectToAccount();
            } else {
                loadUsersTable();
                loadStatistics();
            }
        },
        error: function(error) {
            console.error('Error verifying partner:', error);
            redirectToAccount();
        },
    });
}

function redirectToAccount() {
    localStorage.removeItem('partner_token');
    window.location.href = '/account';
}

function loadStatistics() {
    $.ajax({
        url: '/partner/get_statistics',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
            'X-CSRFToken': $('#csrf_token').val(),
        },
        success: function (data) {
            if (data.status === 'success') {
                // Update only the numbers, since the headings are already in the HTML
                $('#total-qr-codes').text(data.total_qr_codes);
                $('#assigned-qr-codes').text(data.assigned_qr_codes);
                $('#available-qr-codes').text(data.available_qr_codes);
            } else {
                console.error('Error loading statistics:', data);
            }
        },
        error: function (error) {
            console.error('Error loading statistics:', error);
        },
    });
}

function handleAddUser(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);

    const partnerToken = localStorage.getItem('partner_token');
    const csrfToken = $('#csrf_token').val();

    $.ajax({
        url: '/partner/add_user',
        method: 'POST',
        data: formData,
        contentType: false,
        processData: false,
        headers: {
            'Authorization': `Bearer ${partnerToken}`,
            'X-CSRFToken': csrfToken,
        },
        success: function(data) {
            if (data.status === 'success') {
                alert(`User added successfully. Temporary password: ${data.password}`);
                event.target.reset();
                loadUsersTable();
            } else {
                alert('Failed to add user. Please try again.');
            }
        },
        error: function(error) {
            console.error('Error adding user:', error);
            alert('An error occurred. Please try again.');
        },
    });
}
function loadUsersTable() {
    $.ajax({
        url: '/partner/get_users_and_deceased_profiles',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('partner_token')}`,
            'X-CSRFToken': $('#csrf_token').val(),
        },
        success: function (data) {
            if (data.status === 'success') {
                populateUsersTable(data.users);
                $('#total_qr_codes').text(`QR codes available: ${data.total_qr_codes}`);
                $('#qr_codes_container').empty();
                data.qr_code_ids.forEach(function (qrCodeId) {
                    $('#qr_codes_container').append(`<p>${qrCodeId}</p>`);
                });
            } else {
                alert('Failed to fetch users. Please try again.');
            }
        },
        error: function (error) {
            console.error('Error fetching users:', error);
            alert('An error occurred. Please try again.');
        },
    });
}

function populateUsersTable(users) {
    const usersTable = $('#usersTable').DataTable({
        destroy: true,
        data: users,
        columns: [
            { data: 'name' },
            { data: 'email' },
            { data: 'contact_number' },
            { data: 'address' },
            {
                data: 'deceased_profiles',
                render: function (data, type, row) {
                    let profileHtml = '';
                    if (data && data.length > 0) {
                        data.forEach(profile => {
                            profileHtml += `
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>${profile.name} (${profile.date_of_birth} - ${profile.date_of_death}) - ${profile.qr_code}</span>
                                    <button class="btn btn-sm btn-primary edit-profile-btn" data-profile-id="${profile.id}" data-user-id="${row.id}">Edit</button>
                                </div>`;
                        });
                    } else {
                        profileHtml = 'No profiles';
                    }
                    return profileHtml;
                },
            },
            {
                data: null,
                render: function (data, type, row) {
                    return `
                        <button class="btn btn-sm btn-success add-deceased-btn" data-user-id="${row.id}">Add Deceased</button>`;
                },
            },
        ],
        order: [[0, 'asc']], // Sort by name by default
        pageLength: 10, // Pagination with 10 users per page
    });

    // Add click event handlers for "Edit" and "Add Deceased" buttons
    $('#usersTable tbody').on('click', '.edit-profile-btn', function () {
        const profileId = $(this).data('profile-id');
        const userId = $(this).data('user-id');
        currentDeceasedProfileId = profileId;
        currentUserId = userId;
        editDeceasedProfile(profileId, userId);
    });

    $('#usersTable tbody').on('click', '.add-deceased-btn', function () {
        const userId = $(this).data('user-id');
        currentUserId = userId;
        addDeceasedProfile(userId);
    });
}

function editDeceasedProfile() {
    $.ajax({
        url: '/partner/get_deceased_profile/' + currentDeceasedProfileId + '/' + currentUserId,
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('partner_token'),
            'X-CSRFToken': $('#csrf_token').val(),
        },
        success: function (profile) {
            $('#edit-deceased-form #family-tree-outer-container').empty();
            $('#add-deceased-form #family-tree-outer-container').empty();
            $('#edit-deceased-form #family-tree-outer-container').append(`
                <div id="family-tree-container">
                    <div id="family-tree"></div>
                </div>
                <button type="button" id="add-member">Add Family Member</button>
            `);
            initializeFamilyTree(profile.family_tree);
            populateEditForm(profile);
            $('#edit-deceased-modal').fadeIn(300);
        },
        error: function (xhr, status, error) {
            showNotification('Failed to load profile details. Please try again.', 'error');
        }
    });
}

function addDeceasedProfile(userId) {
    resetForm('#add-deceased-form');
    $('#add-deceased-form #family-tree-outer-container').empty();
    $('#edit-deceased-form #family-tree-outer-container').empty();
    $('#add-deceased-form #family-tree-outer-container').append(`
        <div id="family-tree-container">
            <div id="family-tree"></div>
        </div>
        <button type="button" id="add-member">Add Family Member</button>
    `);
    initializeFamilyTree();
    $('#add-deceased-modal').fadeIn(300);
}

















$('#add-deceased-button').click(function () {

});

$('.close').click(function () {
    $(this).closest('.modal').fadeOut(300);
});

$(window).click(function (event) {
    if ($(event.target).hasClass('modal')) {
        $('.modal').fadeOut(300);
    }
});

function addTimelineEvent(container, event = null, index) {
    const eventId = event ? event.id : '';
    const eventHtml = `
        <div class="timeline-event" data-event-id="${eventId}">
            <h4>Event ${index + 1}</h4>
            <input type="hidden" name="event_id[]" value="${eventId}">
            <input type="text" name="event_name[]" placeholder="Event Name" required value="${event ? event.name : ''}">
            <textarea name="event_description[]" placeholder="Event Description" required>${event ? event.description : ''}</textarea>
            
            <div class="event-images" id="images_event_${index}">
                ${event && event.images ? event.images.map((img, imgIndex) => `
                    <div class="event-image">
                        <span class="image-number">Image ${imgIndex + 1} of 3</span>
                        <img src="${img}" alt="Event Image" style="max-width: 100px;">
                        <input type="hidden" name="event_image_${index}[]" value="${img}">
                        <button type="button" class="remove-image btn btn-danger" data-event-index="${index}" data-index="${imgIndex}">Remove Image</button>
                    </div>
                `).join('') : ''}
            </div>
            <button type="button" class="btn btn-secondary add-image" data-event-index="${index}">Add Image</button>
            <button type="button" class="remove-event btn btn-danger">Remove Event</button>
        </div>
    `;
    container.append(eventHtml);
    updateImageCount(`event_${index}`);
}


$(document).on('click', '.add-image', function () {
    const eventIndex = $(this).data('event-index');
    const imageContainer = $(`#images_event_${eventIndex}`);
    const imageCount = imageContainer.find('.event-image').length;

    if (imageCount < 3) {
        const imageHtml = `
            <div class="event-image">
                <span class="image-number">Image ${imageCount + 1} of 3</span>
                <input type="file" name="event_image_${eventIndex}[]" accept="image/*" required>
                <button type="button" class="remove-image btn btn-danger" data-event-index="${eventIndex}">Remove Image</button>
            </div>
        `;
        imageContainer.append(imageHtml);
        updateImageCount(`event_${eventIndex}`);
    } else {
        showNotification('You can only add up to 3 images per event.', 'warning');
    }
});

$(document).on('click', '.remove-image', function () {
    const eventIndex = $(this).data('event-index');
    $(this).closest('.event-image').fadeOut(300, function () {
        $(this).remove();
        updateImageCount(`event_${eventIndex}`);
    });
});

function updateImageCount(eventId) {
    const imageContainer = $(`#images_${eventId}`);
    const imageCount = imageContainer.find('.event-image').length;
    const addImageButton = imageContainer.siblings('.add-image');

    addImageButton.prop('disabled', imageCount >= 3)
        .toggleClass('btn-secondary', imageCount < 3)
        .toggleClass('btn-disabled', imageCount >= 3)
        .text(imageCount >= 3 ? 'Max Images (3)' : 'Add Image');

    imageContainer.find('.event-image').each(function (index) {
        $(this).find('.image-number').text(`Image ${index + 1} of 3`);
    });
}

function addAlbumImage(container, imageUrl = null) {
    const imageCount = container.find('.album-image').length;
    if (imageCount < 15) {
        const imageHtml = `
            <div class="album-image">
                <span class="image-number">Image ${imageCount + 1} of 15</span>
                ${imageUrl ? `
                    <img src="${imageUrl}" alt="Album Image" style="max-width: 100px;">
                    <input type="hidden" name="existing_album_images[]" value="${imageUrl}">
                ` : `
                    <input type="file" name="new_album_images[]" accept="image/*">
                `}
                <button type="button" class="remove-album-image btn btn-danger">Remove Image</button>
            </div>
        `;
        container.append(imageHtml);
        updateAlbumImageCount(container);
    } else {
        showNotification('You can only add up to 15 images to the album.', 'warning');
    }
}

function updateAlbumImageCount(container) {
    const imageCount = container.find('.album-image').length;
    const addImageButton = container.siblings('.add-album-image');

    addImageButton.prop('disabled', imageCount >= 15)
        .toggleClass('btn-secondary', imageCount < 15)
        .toggleClass('btn-disabled', imageCount >= 15)
        .text(imageCount >= 15 ? 'Max Images (15)' : 'Add Album Image');

    container.find('.album-image').each(function (index) {
        $(this).find('.image-number').text(`Image ${index + 1} of 15`);
    });
}

$('#add-timeline-event, #edit-add-timeline-event').click(function () {
    const container = $(this).prev();
    const eventCount = container.children().length;
    if (eventCount < 10) {
        addTimelineEvent(container, null, eventCount);
    } else {
        showNotification('You can only add up to 10 events.', 'warning');
    }
});

$('#add-album-image, #edit-add-album-image').click(function () {
    const container = $(this).prev();
    addAlbumImage(container);
});

$(document).on('click', '.remove-event', function () {
    $(this).closest('.timeline-event').fadeOut(300, function () {
        $(this).remove();
        updateEventNumbers();
    });
});
function updateEventNumbers() {
    $('.timeline-events .timeline-event').each(function (index) {
        $(this).find('h4').text(`Event ${index + 1}`);
        $(this).find('.add-image').data('event-index', index);
        $(this).find('.event-images').attr('id', `images_event_${index}`);
        $(this).find('input[type="file"]').attr('name', `event_image_${index}[]`);
    });
}

$(document).on('click', '.remove-album-image', function () {
    $(this).closest('.album-image').fadeOut(300, function () {
        $(this).remove();
        updateAlbumImageCount($(this).closest('.album-images'));
    });
});

$('#add-deceased-form').submit(function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    formData.append('family_tree', window.saveFamilyTree());


    $.ajax({
        url: '/partner/add_deceased/' + currentUserId,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('partner_token'),
            'X-CSRFToken': $('#csrf_token').val()
        },
        success: function (response) {
            if (response.status === 'success') {
                showNotification('Deceased profile added successfully!', 'success');
                $('#add-deceased-modal').fadeOut(300);
                loadUsersTable();
            } else {
                showNotification('Error: ' + response.message, 'error');
            }
        },
        error: function (xhr, status, error) {
            showNotification('An unexpected error occurred. Please try again.', 'error');
        }
    });
});

function populateEditForm(profile) {
    console.log(profile);
    $('#edit-profile-id').val(profile.id);
    $('#edit-name').val(profile.name);
    $('#edit-dob').val(profile.dob);
    $('#edit-dod').val(profile.dod);
    $('#edit-address').val(profile.address_of_burial);
    $('#edit-url-location').val(profile.url_location);
    $('#edit-about').val(profile.about);
    $('#edit-quote').val(profile.quote);
    $('#edit-is-public').prop('checked', profile.is_public);
    $('#edit-family-tree').val(JSON.stringify(profile.family_tree, null, 2));

    if (profile.image) {
        $('#current-profile-image').attr('src', profile.image).show();
    } else {
        $('#current-profile-image').hide();
    }

    const timelineContainer = $('#edit-timeline-events');
    timelineContainer.empty();
    profile.timeline_events.forEach(function (event, index) {
        addTimelineEvent(timelineContainer, event, index);
    });

    const albumContainer = $('#edit-album-images');
    albumContainer.empty();
    profile.album_images.forEach(function (image) {
        addAlbumImage(albumContainer, image);
    });
    updateAlbumImageCount(albumContainer);
}
$('#edit-deceased-form').submit(function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    formData.append('family_tree', window.saveFamilyTree());

    $.ajax({
        url: '/partner/edit_deceased/' + currentDeceasedProfileId,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('partner_token'),
            'X-CSRFToken': $('#csrf_token').val()
        },
        success: function (response) {
            if (response.status === 'success') {
                showNotification('Deceased profile updated successfully!', 'success');
                $('#edit-deceased-modal').fadeOut(300);
                loadUsersTable();
            } else {
                showNotification('Error: ' + response.message, 'error');
            }
        },
        error: function (xhr, status, error) {
            showNotification('An unexpected error occurred. Please try again.', 'error');
        }
    });
});

function showNotification(message, type) {
    const notification = $('<div>').addClass('notification').addClass(type).text(message);
    $('body').append(notification);
    notification.fadeIn(300).delay(3000).fadeOut(300, function () {
        $(this).remove();
    });
}

function resetForm(formId) {
    $(formId)[0].reset();
    $(formId).find('.timeline-event').remove();
    $(formId).find('.album-image').remove();
    updateAlbumImageCount($(formId).find('#album-images'));
}

function initializeFamilyTree(tree_data = '') {
    const jsPlumbInstance = jsPlumb.getInstance();
    let familyTree = {};
    let currentId = 0;
    let zoomLevel = 1;
    let panX = 0;
    let panY = 0;
    let selectedMember = null;

    const $familyTree = $('#family-tree');
    const $container = $('#family-tree-container');

    jsPlumbInstance.setContainer($familyTree);

    // Initialize jsPlumb defaults
    jsPlumbInstance.importDefaults({
        Connector: ['Flowchart', { cornerRadius: 5 }],
        Anchors: ['Top', 'Right', 'Bottom', 'Left'],
        Endpoint: ['Dot', { radius: 5 }],
        EndpointStyle: { fill: '#4CAF50' },
        PaintStyle: { stroke: '#4CAF50', strokeWidth: 2 },
        HoverPaintStyle: { stroke: '#45a049', strokeWidth: 3 },
        ConnectionsDetachable: false,
    });

    // Pan functionality
    $container.on('mousedown', function(e) {
        let lastX = e.clientX;
        let lastY = e.clientY;
        let isDragging = true;

        $(document).on('mousemove', function(e) {
            if (isDragging) {
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                panX += deltaX;
                panY += deltaY;
                lastX = e.clientX;
                lastY = e.clientY;
                updateTransform();
            }
        });

        $(document).on('mouseup', function() {
            isDragging = false;
            $(document).off('mousemove');
            $(document).off('mouseup');
        });
    });

    function updateTransform() {
        const treeWidth = $familyTree.outerWidth() * zoomLevel;
        const treeHeight = $familyTree.outerHeight() * zoomLevel;
        const containerWidth = $container.width();
        const containerHeight = $container.height();

        // Calculate the maximum allowed pan values
        const maxPanX = 0;
        const minPanX = Math.min(0, containerWidth - treeWidth);
        const maxPanY = 0;
        const minPanY = Math.min(0, containerHeight - treeHeight);

        // Constrain panX and panY to these bounds
        panX = Math.max(minPanX, Math.min(maxPanX, panX));
        panY = Math.max(minPanY, Math.min(maxPanY, panY));

        // Apply the transform
        $familyTree.css('transform', `translate(${panX}px, ${panY}px) scale(${zoomLevel})`);
        jsPlumbInstance.setZoom(zoomLevel);

        $('#zoom-level').text(`${Math.round(zoomLevel * 100)}%`);
    }

    function addFamilyMember(member, x, y) {
        const id = `member-${currentId++}`;
        const $member = $(`
            <div id="${id}" class="family-member" style="left: ${x}px; top: ${y}px;">
                <img src="${member.image || 'https://via.placeholder.com/100'}" alt="${member.name}">
                <h3>${member.name}</h3>
                <p>Born: ${member.dob}</p>
                ${member.dod ? `<p>Died: ${member.dod}</p>` : ''}
                <button type="button" class="edit-btn">✎</button>
                <button type="button" class="delete-btn">×</button>
            </div>
        `);

        $familyTree.append($member);

        familyTree[id] = { ...member, id, x, y };

        jsPlumbInstance.draggable(id, {
            grid: [20, 20],
            containment: 'parent',
            stop: function(event) {
                const newX = parseInt(event.pos[0], 10);
                const newY = parseInt(event.pos[1], 10);
                familyTree[id].x = newX;
                familyTree[id].y = newY;
            }
        });

        // Add endpoints for each side
        ['Top', 'Right', 'Bottom', 'Left'].forEach(anchor => {
            jsPlumbInstance.addEndpoint(id, {
                anchor: anchor,
                isSource: true,
                isTarget: true,
                maxConnections: -1,
            });
        });

        $member.find('.edit-btn').click(function(e) {
            e.stopPropagation();
            openEditForm(id);
        });

        $member.find('.delete-btn').click(function(e) {
            e.stopPropagation();
            deleteFamilyMember(id);
        });

        return id;
    }

    function updateFamilyMember(id, updates) {
        const $member = $(`#${id}`);
        $member.find('h3').text(updates.name);
        $member.find('p').eq(0).text(`Born: ${updates.dob}`);
        if (updates.dod) {
            if ($member.find('p').length === 2) {
                $member.find('p').eq(1).text(`Died: ${updates.dod}`);
            } else {
                $member.append(`<p>Died: ${updates.dod}</p>`);
            }
        } else {
            $member.find('p').eq(1).remove();
        }
        $member.find('img').attr('src', updates.image || 'https://via.placeholder.com/100');

        familyTree[id] = { ...familyTree[id], ...updates };
    }

    function deleteFamilyMember(id) {
        jsPlumbInstance.remove(id);
        delete familyTree[id];
        $(`#${id}`).remove();
    }

    function openEditForm(id) {
        selectedMember = id;
        const member = familyTree[id];
        $('#family-tree-member-name').val(member.name);
        $('#family-tree-member-dob').val(member.dob);
        $('#family-tree-member-dod').val(member.dod || '');
        $('#family-tree-member-image-preview').attr('src', member.image || 'https://via.placeholder.com/100').show();
        $('#family-tree-member-image-upload').hide();
        $('#family-tree-member-image').val(member.image || '');
        $('#member-form').show();
    }

    if (tree_data && tree_data !== '') {
        const { familyTree: loadedTree, connections, zoomLevel: loadedZoom, panX: loadedPanX, panY: loadedPanY } = JSON.parse(tree_data);
        $familyTree.empty();
        jsPlumbInstance.deleteEveryEndpoint();
        familyTree = {};
        currentId = 0;

        // Load family members with their positions
        Object.values(loadedTree).forEach(member => {
            addFamilyMember(member, member.x, member.y);
        });

        // Delay connection creation to ensure all endpoints are ready
        setTimeout(() => {
            // Load connections with their anchors
            connections.forEach(conn => {
                jsPlumbInstance.connect({
                    source: conn.source,
                    target: conn.target,
                    anchors: conn.anchors,
                });
            });

            // Apply loaded zoom and pan
            zoomLevel = loadedZoom;
            panX = loadedPanX;
            panY = loadedPanY;
            updateTransform();

            // Repaint everything to ensure all elements are correctly positioned and connected
            jsPlumbInstance.repaintEverything();
        }, 100);
    }

    // Function to save the family tree state
    window.saveFamilyTree = function() {
        const connections = jsPlumbInstance.getConnections().map(conn => ({
            source: conn.sourceId,
            target: conn.targetId,
            anchors: [conn.endpoints[0].anchor.type, conn.endpoints[1].anchor.type]
        }));
        const data = JSON.stringify({
            familyTree: Object.values(familyTree),
            connections,
            zoomLevel,
            panX,
            panY
        });
        return data;
    }

    // Bind events after tree is loaded
    $('#add-member').click(function() {
        selectedMember = null;
        $('#member-form').show();
        $('#family-tree-member-image-preview').hide();
        $('#family-tree-member-image-upload').show();
        $('#family-tree-member-image').val('');
        $('#member-details')[0].reset();
    });

    $('#cancel-form').click(function() {
        $('#member-form').hide();
        $('#family-tree-member-image-preview').attr('src', '');
        $('#family-tree-member-image').val('');
        $('#member-details')[0].reset();
    });

    $('#member-details').submit(function(e) {
        e.preventDefault();
        const member = {
            name: $('#family-tree-member-name').val(),
            dob: $('#family-tree-member-dob').val(),
            dod: $('#family-tree-member-dod').val(),
            image: $('#family-tree-member-image').val() || $('#family-tree-member-image-preview').attr('src')
        };

        if (selectedMember) {
            updateFamilyMember(selectedMember, member);
        } else {
            const centerX = ($container.width() / 2 - 50) / zoomLevel - panX;
            const centerY = ($container.height() / 2 - 50) / zoomLevel - panY;
            addFamilyMember(member, centerX, centerY);
        }

        $('#member-form').hide();
        this.reset();
        $('#family-tree-member-image-preview').attr('src', '');
        selectedMember = null;
    });

    $('#family-tree-member-image-upload').change(function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageDataUrl = e.target.result;
                $('#family-tree-member-image').val(imageDataUrl);
                $('#family-tree-member-image-preview').attr('src', imageDataUrl).show();
                $('#family-tree-member-image-upload').hide();
            };
            reader.readAsDataURL(file);
        }
    });
}
