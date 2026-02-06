import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- References ---
    const loadingState = document.getElementById('loading-state');
    const bookingCard = document.getElementById('booking-card');
    const backLink = document.getElementById('back-link');
    const form = document.getElementById('booking-form');
    const submitBtn = document.getElementById('submit-btn');

    // Display Fields
    const displayTitle = document.getElementById('summary-title');
    const displayDate = document.getElementById('summary-date');
    const displayLocation = document.getElementById('summary-location');
    const displayPrice = document.getElementById('summary-price');
    const displayTotal = document.getElementById('summary-total');
    const ticketsInput = document.getElementById('tickets');

    // Create Promo Code Input
    let promoContainer = document.getElementById('promo-container');
    if (!promoContainer) {
        promoContainer = document.createElement('div');
        promoContainer.className = 'form-group';
        promoContainer.id = 'promo-container';

        promoContainer.innerHTML = `
            <label for="promo-code">Influencer Code (Optional)</label>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="promo-code" placeholder="Enter code" style="flex:1;">
                <button type="button" id="apply-code-btn" class="btn btn-outline" style="padding: 10px 16px; font-size: 0.9rem;">Apply</button>
            </div>
            <p id="promo-message" style="font-size: 0.85rem; margin-top: 4px; min-height: 1.25em;"></p>
        `;

        // Insert before button
        const btn = form.querySelector('button[type="submit"]');
        form.insertBefore(promoContainer, btn);
    }

    const promoInput = document.getElementById('promo-code');
    const applyBtn = document.getElementById('apply-code-btn');
    const promoMsg = document.getElementById('promo-message');

    // --- Logic ---
    let baseTicketPrice = 0;
    let currentTicketPrice = 0; // After discount
    let discountPercent = 0;
    let eventId = new URLSearchParams(window.location.search).get('id');
    const urlCode = new URLSearchParams(window.location.search).get('code');

    // Ticket Types State
    let ticketTypes = [];
    let selectedTicketType = null;
    const ticketTypeGroup = document.getElementById('ticket-type-group');
    const ticketTypeOptions = document.getElementById('ticket-type-options');

    // Pre-fill code if present in URL
    if (urlCode) {
        promoInput.value = urlCode;
        // Optional: Auto-click apply? Let's just fill it for now.
    }

    // Fallback ID from path if needed
    if (!eventId) {
        // ... path matching logic if needed ...
    }

    if (!eventId) {
        alert('Invalid Booking URL');
        window.location.href = '/';
        return;
    }

    // Load Event
    async function loadEvent() {
        try {
            // Fetch event
            const { data: event, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (error || !event) throw new Error('Event not found');

            // Fetch ticket types for this event
            const { data: types, error: typesError } = await supabase
                .from('ticket_types')
                .select('*')
                .eq('event_id', eventId)
                .order('sort_order', { ascending: true });

            if (!typesError && types && types.length > 0) {
                ticketTypes = types;
            } else {
                // Fallback: Create a virtual "General" type from event price
                ticketTypes = [{
                    id: 'legacy',
                    name: 'General Admission',
                    price: event.price,
                    description: null
                }];
            }

            renderBookingPage(event);

            // Auto-apply if code in URL
            if (urlCode) {
                applyBtn.click();
            }

        } catch (err) {
            console.error(err);
            alert('Error loading event data.');
            window.location.href = '/';
        }
    }
    loadEvent();

    function renderBookingPage(event) {
        // Populate Summary
        displayTitle.textContent = event.title;
        const dateObj = new Date(event.date);
        displayDate.textContent = dateObj.toLocaleDateString();
        displayLocation.textContent = event.location;

        // Render Ticket Types
        renderTicketTypes();

        updateBackLink();

        loadingState.style.display = 'none';
        bookingCard.style.display = 'grid';
        bookingCard.style.opacity = '1';
    }

    function renderTicketTypes() {
        // If only one type, auto-select it and hide selector
        if (ticketTypes.length === 1) {
            selectTicketType(ticketTypes[0]);
            ticketTypeGroup.style.display = 'none';
            return;
        }

        // Multiple types - show selector
        ticketTypeGroup.style.display = 'block';
        ticketTypeOptions.innerHTML = '';

        ticketTypes.forEach((type, index) => {
            const card = document.createElement('div');
            card.className = 'ticket-type-card';
            card.dataset.typeId = type.id;
            card.style.cssText = `
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            card.innerHTML = `
                <div>
                    <strong style="font-size: 1rem;">${type.name}</strong>
                    ${type.description ? `<div style="font-size: 0.85rem; color: #6b7280;">${type.description}</div>` : ''}
                </div>
                <div style="font-weight: 600; color: var(--color-accent);">₹${type.price}</div>
            `;

            card.addEventListener('click', () => {
                // Remove selection from all
                ticketTypeOptions.querySelectorAll('.ticket-type-card').forEach(c => {
                    c.style.borderColor = '#e5e7eb';
                    c.style.background = 'transparent';
                });
                // Select this one
                card.style.borderColor = 'var(--color-accent)';
                card.style.background = 'rgba(234, 189, 8, 0.1)';
                selectTicketType(type);
            });

            ticketTypeOptions.appendChild(card);

            // Auto-select first
            if (index === 0) {
                card.click();
            }
        });
    }

    function selectTicketType(type) {
        selectedTicketType = type;
        baseTicketPrice = type.price;
        currentTicketPrice = type.price;
        displayPrice.textContent = baseTicketPrice > 0 ? `₹${baseTicketPrice}` : 'Free';

        // Reset discount when type changes
        discountPercent = 0;
        updateTotal();
    }

    function updateBackLink() {
        backLink.href = `/event.html?id=${eventId}`;
    }

    function updateTotal() {
        const count = parseInt(ticketsInput.value) || 1;
        const total = count * currentTicketPrice;

        // Update Total Display
        if (total > 0) {
            let html = `₹${Math.round(total)}`;
            if (discountPercent > 0) {
                html += ` <small style="color: #10B981; font-size: 0.8em; font-weight: 500;">(${discountPercent}% OFF applied)</small>`;
            }
            displayTotal.innerHTML = html;
        } else {
            displayTotal.textContent = 'Free';
        }
    }

    // Apply Code Handler
    applyBtn.addEventListener('click', async () => {
        const code = promoInput.value.trim();
        if (!code) {
            promoMsg.textContent = 'Please enter a code.';
            promoMsg.style.color = 'red';
            return;
        }

        applyBtn.textContent = '...';
        applyBtn.disabled = true;
        promoMsg.textContent = '';

        try {
            const res = await fetch('/api/validate-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await res.json();

            if (res.ok && data.valid) {
                discountPercent = data.discountPercent || 0;
                const discountAmount = (baseTicketPrice * discountPercent) / 100;
                currentTicketPrice = Math.max(0, baseTicketPrice - discountAmount);

                promoMsg.textContent = `Code '${code}' applied! You save ${discountPercent}%`;
                promoMsg.style.color = '#10B981';

                // Update Price Per Ticket UI to show slashed price
                displayPrice.innerHTML = `<span style="text-decoration: line-through; color: #999;">₹${baseTicketPrice}</span> ₹${Math.round(currentTicketPrice)}`;

                updateTotal();

            } else {
                throw new Error(data.error || 'Invalid Code');
            }

        } catch (err) {
            console.error(err);
            promoMsg.textContent = err.message || 'Invalid Code';
            promoMsg.style.color = '#EF4444';

            // Reset
            discountPercent = 0;
            currentTicketPrice = baseTicketPrice;
            displayPrice.textContent = `₹${baseTicketPrice}`;
            updateTotal();
        } finally {
            applyBtn.textContent = 'Apply';
            applyBtn.disabled = false;
        }
    });

    ticketsInput.addEventListener('input', updateTotal);
    ticketsInput.addEventListener('change', updateTotal);

    // --- Submit ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const promoCode = promoInput.value.trim();

        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            // 1. Create Order via Backend
            const response = await fetch('/api/create-razorpay-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId,
                    ticketTypeId: selectedTicketType?.id || null,
                    quantity: parseInt(ticketsInput.value) || 1,
                    influencerCode: promoCode || null,
                    customerDetails: { name, email, phone }
                })
            });

            const orderData = await response.json();

            if (!response.ok) {
                throw new Error(orderData.error || 'Failed to create order');
            }

            // 2. Handle Free Event (Auto-confirmed)
            if (orderData.amount === 0) {
                window.location.href = '/success.html';
                return;
            }

            // 3. Open Razorpay
            const options = {
                "key": orderData.key,
                "amount": orderData.amount,
                "currency": orderData.currency,
                "name": "SK Events",
                "description": `Booking for ${displayTitle.textContent}`,
                "order_id": orderData.orderId,
                "handler": function (response) {
                    // Payment Success - Webhook handles DB update, 
                    // but we redirect user to success page
                    console.log('Payment Success:', response);
                    window.location.href = '/success.html';
                },
                "prefill": {
                    "name": name,
                    "email": email,
                    "contact": phone
                },
                "theme": {
                    "color": "#0F172A"
                },
                "modal": {
                    "ondismiss": function () {
                        submitBtn.textContent = 'Proceed to Payment';
                        submitBtn.disabled = false;
                    }
                }
            };

            const rzp1 = new Razorpay(options);
            rzp1.on('payment.failed', function (response) {
                alert('Payment Failed: ' + response.error.description);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Retry Payment';
            });
            rzp1.open();

        } catch (err) {
            console.error('Booking Error:', err);
            alert('Error: ' + err.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Proceed to Payment';
        }
    });

    // Add Razorpay Script dynamically if not present
    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        const script = document.createElement('script');
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        document.body.appendChild(script);
    }
});
