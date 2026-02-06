
import { supabase } from '/supabaseClient.js';

// --- State ---
const state = {
    currentSection: null,
    isLoading: false,
    data: [],
    currentUser: null
};

// --- DOM Elements ---
const dom = {
    dynamicContent: document.getElementById('dynamic-content'),
    navButtons: document.querySelectorAll('.card-btn'),
    modal: document.getElementById('modal-overlay'),
    modalContent: document.getElementById('modal-body'),
    modalTitle: document.querySelector('.modal-header h2')
};

// --- Init ---
async function init() {
    // 1. Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (error || profile?.role !== 'admin') {
            alert('⛔ Access Denied: Admin privileges required.');
            window.location.href = '/';
            return;
        }

        state.currentUser = session.user;
        console.log('✅ Admin Logged In');

        // Setup Global Listeners
        setupNavigation();
        setupModal();

    } catch (err) {
        console.error('Auth Init Error:', err);
        window.location.href = '/';
    }
}

// --- Navigation ---
function setupNavigation() {
    // Use event delegation for card buttons if possible, or bind directly
    // Assuming buttons have data-section attributes
    document.querySelectorAll('[data-section]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            switchSection(section);
        });
    });
}

async function switchSection(section) {
    if (state.currentSection === section && !state.isLoading) return; // Prevent double load unless needed

    state.currentSection = section;

    // Update Active State
    document.querySelectorAll('.card-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });

    renderLoading();

    switch (section) {
        case 'events':
            await loadEvents();
            break;
        case 'influencers':
            await loadInfluencers();
            break;
        case 'bookings':
            await loadBookings();
            break;
        case 'approvals':
            await loadApprovals();
            break;
        default:
            renderError('Unknown Section');
    }
}

// --- Render Helpers ---
function renderLoading() {
    dom.dynamicContent.innerHTML = `
        <div class="state-container">
            <div class="spinner"></div>
            <p>Loading data...</p>
        </div>
    `;
    dom.dynamicContent.classList.add('visible');
}

function renderError(message) {
    dom.dynamicContent.innerHTML = `
        <div class="state-container">
            <p style="color: var(--danger);">⚠️ ${message}</p>
            <button class="btn-primary" onclick="location.reload()">Retry</button>
        </div>
    `;
}

function renderEmpty(message) {
    dom.dynamicContent.innerHTML = `
        <div class="state-container">
            <p style="color: var(--text-secondary); font-style: italic;">${message}</p>
        </div>
    `;
}

// --- 1. Manage Events ---
// --- 1. Manage Events ---
async function loadEvents() {
    try {
        // Fetch Events
        const { data: events, error } = await supabase
            .from('events')
            .select('*')
            .order('date', { ascending: true });

        if (error) throw error;

        // Fetch Featured Events
        const { data: featured, error: featError } = await supabase
            .from('featured_events')
            .select('event_id');

        if (featError) throw featError;

        // Create a Set for quick lookup
        const featuredSet = new Set(featured.map(f => f.event_id));

        // Render Frame
        dom.dynamicContent.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Events Management</h2>
                <button class="btn-primary" id="add-event-btn">+ Add New Event</button>
            </div>
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th width="5%">Feat.</th>
                            <th width="35%">Title</th>
                            <th width="20%">Date</th>
                            <th width="15%">Price</th>
                            <th width="25%">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="events-table-body"></tbody>
                </table>
            </div>
        `;

        // Bind Add Button
        document.getElementById('add-event-btn').addEventListener('click', () => openEventModal());

        if (!events || events.length === 0) {
            document.getElementById('events-table-body').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No events found.</td></tr>`;
            return;
        }

        const tbody = document.getElementById('events-table-body');
        tbody.innerHTML = events.map(event => {
            const isFeatured = featuredSet.has(event.id);
            return `
            <tr>
                <td style="text-align: center;">
                    <button class="action-btn btn-star ${isFeatured ? 'active' : ''}" data-id="${event.id}" data-featured="${isFeatured}" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: ${isFeatured ? '#FFD700' : '#ccc'};">
                        ${isFeatured ? '★' : '☆'}
                    </button>
                </td>
                <td>
                    <div style="font-weight: 500;">${event.title}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${event.location}</div>
                </td>
                <td>${new Date(event.date).toLocaleDateString()} ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>₹${event.price}</td>
                <td>
                    <button class="action-btn btn-edit" data-id="${event.id}">Edit</button>
                    <button class="action-btn btn-delete" data-id="${event.id}">Delete</button>
                </td>
            </tr>
        `}).join('');

        // Bind Actions
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const event = events.find(e => e.id === btn.dataset.id);
                openEventModal(event);
            });
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteEvent(btn.dataset.id));
        });

        // Bind Star Toggle
        tbody.querySelectorAll('.btn-star').forEach(btn => {
            btn.addEventListener('click', async () => {
                const eventId = btn.dataset.id;
                const isFeatured = btn.dataset.featured === 'true';
                await toggleFeatured(eventId, isFeatured);
            });
        });

    } catch (err) {
        console.error(err);
        renderError('Failed to load events.');
    }
}

async function toggleFeatured(eventId, currentlyFeatured) {
    try {
        if (currentlyFeatured) {
            // Remove from Featured
            const { error } = await supabase
                .from('featured_events')
                .delete()
                .eq('event_id', eventId);

            if (error) throw error;
        } else {
            // Add to Featured
            // 1. Get max display_order
            const { data: maxData, error: maxError } = await supabase
                .from('featured_events')
                .select('display_order')
                .order('display_order', { ascending: false })
                .limit(1);

            let nextOrder = 1;
            if (!maxError && maxData && maxData.length > 0) {
                nextOrder = (maxData[0].display_order || 0) + 1;
            }

            // 2. Insert
            const { error: insertError } = await supabase
                .from('featured_events')
                .insert([{ event_id: eventId, display_order: nextOrder }]);

            if (insertError) throw insertError;
        }

        // Reload to refresh UI
        await loadEvents();

    } catch (err) {
        console.error(err);
        alert('Failed to update featured status: ' + err.message);
    }
}

// Reuseable Event Modal Form
function openEventModal(event = null) {
    const isEdit = !!event;
    const title = isEdit ? 'Edit Event' : 'Add New Event';

    const html = `
        <form id="event-form">
            <div class="form-group">
                <label>Event Title</label>
                <input type="text" name="title" class="form-control" value="${event?.title || ''}" required>
            </div>
            <div class="form-group">
                <label>Date & Time</label>
                <input type="datetime-local" name="date" class="form-control" value="${event?.date ? new Date(event.date).toISOString().slice(0, 16) : ''}" required>
            </div>
            <div class="form-group">
                <label>Location</label>
                <input type="text" name="location" class="form-control" value="${event?.location || ''}" required>
            </div>
            <div class="form-group">
                <label>Total Capacity</label>
                <input type="number" name="capacity" class="form-control" value="${event?.capacity || 100}" required min="1">
            </div>
            
            <!-- Ticket Types Section -->
            <div class="form-group">
                <label style="display: flex; justify-content: space-between; align-items: center;">
                    Ticket Types
                    <button type="button" id="add-ticket-type-btn" class="btn-primary" style="font-size: 0.8rem; padding: 4px 10px; background: transparent; border: 1px solid var(--accent-yellow); color: var(--accent-yellow);">+ Add Type</button>
                </label>
                <div id="ticket-types-container" style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px;">
                    <!-- Ticket type rows will be added here -->
                </div>
                <input type="hidden" name="price" value="0"> <!-- Fallback for legacy -->
            </div>
            
            <div class="form-group">
                <label>Description</label>
                <textarea name="description" class="form-control" rows="3" required>${event?.description || ''}</textarea>
            </div>

            <!-- UDPATED: Image Upload Section -->
            <div class="form-group">
                <label>Event Image</label>
                <!-- Hidden Input for File -->
                <input type="file" id="event-file-upload" accept="image/*" class="form-control" style="display: none;">
                
                <!-- Preview & Upload Button -->
                <div style="display: flex; flex-direction: column; gap: 10px; align-items: start; width: 100%;">
                    <button type="button" class="btn-primary" style="background: transparent; border: 1px solid var(--accent-yellow); color: var(--accent-yellow);" onclick="document.getElementById('event-file-upload').click()">
                        ${isEdit ? 'Change Image' : 'Upload Image'}
                    </button>
                    <span id="file-name-display" style="font-size: 0.85rem; color: var(--text-secondary);"></span>
                </div>

                <!-- Hidden Input to store the final URL -->
                <input type="hidden" name="image_url" id="final-image-url" value="${event?.image_url || ''}">
                
                <!-- Preview Image -->
                <div style="margin-top: 10px;">
                    <img id="event-img-preview" src="${event?.image_url || ''}" style="max-width: 100%; height: 150px; object-fit: cover; border-radius: 8px; display: ${event?.image_url ? 'block' : 'none'}; border: 1px solid var(--border-color);">
                </div>
            </div>

            <div class="form-group">
                <button type="submit" class="btn-primary" id="save-event-btn" style="width: 100%;">${isEdit ? 'Update Event' : 'Create Event'}</button>
            </div>
        </form>
    `;

    openModal(title, html);

    // --- Ticket Types Management ---
    const ticketTypesContainer = document.getElementById('ticket-types-container');
    let ticketTypeCounter = 0;

    function createTicketTypeRow(typeData = {}) {
        const rowId = `ticket-type-${ticketTypeCounter++}`;
        const row = document.createElement('div');
        row.id = rowId;
        row.style.cssText = 'display: grid; grid-template-columns: 1fr 100px 1fr 40px; gap: 8px; align-items: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;';
        row.innerHTML = `
            <input type="text" placeholder="Type Name (e.g., Single)" value="${typeData.name || ''}" class="form-control ticket-name" required style="font-size: 0.9rem;">
            <input type="number" placeholder="Price" value="${typeData.price || ''}" class="form-control ticket-price" required min="0" style="font-size: 0.9rem;">
            <input type="text" placeholder="Description (optional)" value="${typeData.description || ''}" class="form-control ticket-desc" style="font-size: 0.9rem;">
            <button type="button" class="remove-ticket-btn" style="background: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1.2rem; padding: 4px 8px;">&times;</button>
        `;
        row.dataset.existingId = typeData.id || ''; // Store existing ID for updates
        row.querySelector('.remove-ticket-btn').addEventListener('click', () => row.remove());
        return row;
    }

    // Add Type Button
    document.getElementById('add-ticket-type-btn').addEventListener('click', () => {
        ticketTypesContainer.appendChild(createTicketTypeRow());
    });

    // Load existing ticket types if editing
    if (isEdit && event?.id) {
        (async () => {
            // Clear container first to prevent duplicates
            ticketTypesContainer.innerHTML = '';

            const { data: types, error } = await supabase
                .from('ticket_types')
                .select('*')
                .eq('event_id', event.id)
                .order('sort_order', { ascending: true });

            if (!error && types && types.length > 0) {
                types.forEach(t => ticketTypesContainer.appendChild(createTicketTypeRow(t)));
            } else {
                // Add one default row if no types exist
                ticketTypesContainer.appendChild(createTicketTypeRow({ name: 'General', price: event.price || 0 }));
            }
        })();
    } else {
        // Add one default row for new events
        ticketTypesContainer.appendChild(createTicketTypeRow({ name: 'General', price: '' }));
    }

    // File Selection Handler
    const fileInput = document.getElementById('event-file-upload');
    const preview = document.getElementById('event-img-preview');
    const nameDisplay = document.getElementById('file-name-display');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            nameDisplay.textContent = file.name;
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }
    });

    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-event-btn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const formData = new FormData(e.target);
            let imageUrl = formData.get('image_url'); // Get existing URL if unchanged

            // Upload New File if selected
            if (fileInput.files.length > 0) {
                btn.textContent = 'Uploading Image...';
                const file = fileInput.files[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `event-${Date.now()}.${fileExt}`;

                const { data, error: uploadError } = await supabase.storage
                    .from('events') // Bucket Name
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('events')
                    .getPublicUrl(fileName);

                imageUrl = publicUrl;
            }

            if (!imageUrl) {
                throw new Error("Please upload an image for the event.");
            }

            // Collect ticket types from form
            const ticketTypeRows = ticketTypesContainer.querySelectorAll('[id^="ticket-type-"]');
            const ticketTypes = [];
            let minPrice = Infinity;

            ticketTypeRows.forEach((row, index) => {
                const name = row.querySelector('.ticket-name').value.trim();
                const price = parseFloat(row.querySelector('.ticket-price').value) || 0;
                const description = row.querySelector('.ticket-desc').value.trim();
                const existingId = row.dataset.existingId;

                if (name && price >= 0) {
                    ticketTypes.push({ name, price, description, sort_order: index, existingId });
                    if (price < minPrice) minPrice = price;
                }
            });

            if (ticketTypes.length === 0) {
                throw new Error("Please add at least one ticket type.");
            }

            // Use minimum price as the event's legacy price
            const legacyPrice = minPrice === Infinity ? 0 : minPrice;

            // Construct Payload
            const payload = {
                title: formData.get('title'),
                description: formData.get('description'),
                date: formData.get('date'),
                location: formData.get('location'),
                price: legacyPrice, // For backward compatibility
                capacity: formData.get('capacity'),
                image_url: imageUrl
            };

            btn.textContent = 'Saving Event...';

            let eventId = event?.id;

            if (isEdit) {
                const { error } = await supabase.from('events').update(payload).eq('id', event.id);
                if (error) throw error;
            } else {
                const { data: newEvent, error } = await supabase.from('events').insert([payload]).select().single();
                if (error) throw error;
                eventId = newEvent.id;
            }

            // Save Ticket Types
            btn.textContent = 'Saving Ticket Types...';

            // Delete old ticket types for this event (simpler than upsert logic)
            await supabase.from('ticket_types').delete().eq('event_id', eventId);

            // Insert new ticket types
            const ticketTypePayloads = ticketTypes.map(t => ({
                event_id: eventId,
                name: t.name,
                price: t.price,
                description: t.description || null,
                sort_order: t.sort_order
            }));

            const { error: ticketError } = await supabase.from('ticket_types').insert(ticketTypePayloads);
            if (ticketError) throw ticketError;

            closeModal();
            loadEvents(); // Refresh

        } catch (err) {
            console.error(err);
            alert('Error saving event: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

async function confirmDeleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;

    try {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        loadEvents();
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}


// --- 2. Manage Influencers ---
async function loadInfluencers() {
    try {
        // Step 1: Fetch Influencers
        const { data: influencers, error } = await supabase
            .from('influencers')
            .select('*')
            .eq('active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        dom.dynamicContent.innerHTML = `
             <div class="section-header">
                <h2 class="section-title">Influencer Network</h2>
            </div>
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="infl-table-body"></tbody>
                </table>
            </div>
        `;

        if (!influencers || influencers.length === 0) {
            document.getElementById('infl-table-body').innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">No active influencers.</td></tr>`;
            return;
        }

        // Step 2: Fetch Profiles (Manual Join)
        // User clarified: influencers.id IS the user link (no separate user_id column)
        const userIds = influencers.map(inf => inf.id).filter(id => id);

        // If no valid user IDs, proceed with empty profiles (still show rows with just keys)
        let profiles = [];
        if (userIds.length > 0) {
            const { data: fetchedProfiles, error: profError } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', userIds);

            if (profError) {
                console.warn('Profile fetch warning:', profError);
            } else {
                profiles = fetchedProfiles;
            }
        }

        // Map profiles to a lookup object
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p);
        }

        const tbody = document.getElementById('infl-table-body');
        tbody.innerHTML = influencers.map(inf => {
            const profile = profileMap[inf.id] || {};

            // Robust Name Generation
            // Robust Name Generation: prioritize full_name as per user request
            let displayName = profile.full_name;

            // Fallback to email username if absolutely no name is found
            if (!displayName) {
                const emailObj = profile.email || inf.email;
                if (emailObj) displayName = emailObj.split('@')[0];
            }

            const finalName = displayName || 'Unknown User';
            const displayEmail = profile.email || inf.email || 'No Email';
            return `
            <tr>
                <td>${finalName}</td>
                <td><span style="background: rgba(234, 189, 8, 0.1); color: var(--accent-yellow); padding: 2px 6px; border-radius: 4px;">${inf.code}</span></td>
                <td>${displayEmail}</td>
                <td>
                    <button class="action-btn btn-delete" data-id="${inf.id}">Revoke Access</button>
                </td>
            </tr>
        `}).join('');

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => revokeInfluencer(btn.dataset.id));
        });

    } catch (err) {
        console.error(err);
        renderError('Failed to load influencers.');
    }
}

async function revokeInfluencer(userId) {
    if (!confirm('Revoke influencer status? This will disable their account.')) return;

    try {
        // Strategy: Soft Delete (active = false) because they likely have related bookings
        // Hard deleting would fail if foreign keys (bookings) exist.

        // 1. Mark as Inactive in Influencers table
        const { error: infError } = await supabase
            .from('influencers')
            .update({ active: false })
            .eq('id', userId);

        if (infError) throw infError;

        // 2. Reset Profile Role to User
        const { error: profError } = await supabase
            .from('profiles')
            .update({ role: 'user' })
            .eq('id', userId);

        if (profError) throw profError;

        alert('Influencer access revoked.');
        await loadInfluencers(); // Refresh list

    } catch (err) {
        console.error(err);
        alert('Operation failed: ' + err.message);
    }
}

// --- 3. View Bookings ---
async function loadBookings() {
    try {
        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('*, events(title)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        dom.dynamicContent.innerHTML = `
             <div class="section-header">
                <h2 class="section-title">Booking Transactions</h2>
            </div>
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Event</th>
                            <th>Status</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="bookings-table-body"></tbody>
                </table>
            </div>
        `;

        if (!bookings || bookings.length === 0) {
            document.getElementById('bookings-table-body').innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No bookings found.</td></tr>`;
            return;
        }

        const tbody = document.getElementById('bookings-table-body');
        tbody.innerHTML = bookings.map(b => {
            const statusColor = b.status === 'paid' ? 'var(--success)' : b.status === 'pending' ? 'var(--accent-yellow)' : 'var(--danger)';
            return `
             <tr>
                 <td>
                     <div>${b.customer_name || 'N/A'}</div>
                     <div style="font-size:0.8rem; color: var(--text-secondary);">${b.customer_email}</div>
                 </td>
                 <td>${b.events?.title || 'Unknown Event'}</td>
                 <td><span style="color: ${statusColor}; font-weight: 600; text-transform: uppercase; font-size: 0.8rem;">${b.status}</span></td>
                 <td>₹${b.amount}</td>
                <td>${new Date(b.created_at).toLocaleDateString()}</td>
                <td>
                     <button class="action-btn btn-delete" data-id="${b.id}">Delete</button>
                </td>
            </tr>
        `;
        }).join('');

        // Bind Booking Actions
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteBooking(btn.dataset.id));
        });

    } catch (err) {
        console.error(err);
        renderError('Failed to load bookings.');
    }
}

async function deleteBooking(id) {
    if (!confirm('Are you sure you want to delete this booking? This cannot be undone.')) return;

    try {
        const { error } = await supabase.from('bookings').delete().eq('id', id);
        if (error) throw error;
        loadBookings(); // Refresh
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
}


// --- 4. Pending Approvals ---
async function loadApprovals() {
    try {
        const { data: requests, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'pending_influencer')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        dom.dynamicContent.innerHTML = `
             <div class="section-header">
                <h2 class="section-title">Pending Approvals</h2>
            </div>
            <div class="table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Applicant</th>
                            <th>Email</th>
                            <th>Requested</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="approvals-table-body"></tbody>
                </table>
            </div>
        `;

        if (!requests || requests.length === 0) {
            document.getElementById('approvals-table-body').innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 2rem;">No pending requests.</td></tr>`;
            return;
        }

        const tbody = document.getElementById('approvals-table-body');
        tbody.innerHTML = requests.map(req => `
            <tr>
                <td>${req.full_name || req.name || 'N/A'}</td>
                <td>${req.email}</td>
                <td>${new Date(req.updated_at || req.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn btn-approve" data-id="${req.id}" data-meta='${JSON.stringify({ email: req.email, full_name: req.full_name || req.name })}'>Approve</button>
                    <button class="action-btn btn-reject" data-id="${req.id}">Reject</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-approve').forEach(btn => {
            btn.addEventListener('click', () => handleApproval(btn.dataset.id, JSON.parse(btn.dataset.meta), true));
        });

        tbody.querySelectorAll('.btn-reject').forEach(btn => {
            btn.addEventListener('click', () => handleApproval(btn.dataset.id, {}, false));
        });

    } catch (err) {
        console.error(err);
        renderError('Failed to load pending approvals.');
    }
}

async function handleApproval(userId, meta, isApproved) {
    if (!confirm(`Are you sure you want to ${isApproved ? 'APPROVE' : 'REJECT'} this request?`)) return;

    try {
        if (isApproved) {
            // 1. Generate Code from full_name
            const name = meta.full_name || 'User';
            const code = name.toUpperCase().replace(/\s+/g, '').substring(0, 4) + Math.floor(1000 + Math.random() * 9000);

            // 2. Insert Influencer
            const { error: infError } = await supabase.from('influencers').insert([{
                id: userId,
                email: meta.email,
                code: code,
                active: true
            }]);

            if (infError) throw infError;

            // 3. Update Profile
            await supabase.from('profiles').update({ role: 'influencer' }).eq('id', userId);

            // 4. Send Email (Optional - fire and forget)
            fetch('/api/send-approval-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: meta.email, name: meta.full_name, status: 'approved', code })
            });

        } else {
            // Reject -> Set role to user
            await supabase.from('profiles').update({ role: 'user' }).eq('id', userId);
        }

        loadApprovals(); // Refresh

    } catch (err) {
        alert('Action failed: ' + err.message);
    }
}

// --- Modal Helpers ---
function openModal(title, contentHtml) {
    dom.modalTitle.textContent = title;
    dom.modalContent.innerHTML = contentHtml;
    dom.modal.classList.add('active');
}

function setupModal() {
    // Close on click outside
    dom.modal.addEventListener('click', (e) => {
        if (e.target === dom.modal) closeModal();
    });
    // Close button (if we added one, currently using click outside or esc)
}

function closeModal() {
    dom.modal.classList.remove('active');
}


// Start
document.addEventListener('DOMContentLoaded', init);
