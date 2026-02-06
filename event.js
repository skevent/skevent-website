import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const eventContainer = document.getElementById('event-full-details');
    if (!eventContainer) return;

    // Get Event ID from URL
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('id');

    if (!eventId) {
        renderError('No event specified.');
        return;
    }

    try {
        const { data: event, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error || !event) {
            console.error('Event fetch error:', error);
            renderError('Event not found or unavailable.');
            return;
        }

        // Fetch ticket types for this event
        const { data: ticketTypes, error: typesError } = await supabase
            .from('ticket_types')
            .select('*')
            .eq('event_id', eventId)
            .order('sort_order', { ascending: true });

        // Use fetched types or fallback to legacy price
        const types = (!typesError && ticketTypes && ticketTypes.length > 0)
            ? ticketTypes
            : [{ id: 'legacy', name: 'General Admission', price: event.price, description: null }];

        renderEvent(event, types);
    } catch (err) {
        console.error('Error fetching event:', err);
        renderError('Event not found or unavailable.');
    }

    function renderEvent(item, ticketTypes) {
        const dateObj = new Date(item.date);
        const dateStr = isNaN(dateObj)
            ? item.date
            : dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

        const imageUrl =
            item.image_url ||
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80';

        const slotsDisplay = item.capacity ? `${item.capacity} Spots` : 'Open Entry';

        // Generate premium ticket types cards
        const ticketTypesHtml = ticketTypes.map((t, idx) => {
            const icons = ['🎫', '👥', '👨‍👩‍👧‍👦', '⭐', '💎'];
            const icon = icons[idx % icons.length];
            const gradients = [
                'linear-gradient(135deg, rgba(234, 189, 8, 0.15) 0%, rgba(234, 189, 8, 0.05) 100%)',
                'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(168, 85, 247, 0.05) 100%)',
                'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)'
            ];
            const borderColors = ['#eabd08', '#a855f7', '#3b82f6', '#10b981', '#ef4444'];

            return `
            <div class="ticket-card" style="
                background: ${gradients[idx % gradients.length]};
                border: 1px solid ${borderColors[idx % borderColors.length]}33;
                border-radius: 16px;
                padding: 1.25rem;
                display: flex;
                align-items: center;
                gap: 1rem;
                transition: all 0.3s ease;
                cursor: pointer;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.2)';"
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                <div style="
                    width: 50px;
                    height: 50px;
                    background: ${borderColors[idx % borderColors.length]}22;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                ">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 1.1rem; color: var(--color-text, #fff); margin-bottom: 2px;">${t.name}</div>
                    ${t.description ? `<div style="font-size: 0.85rem; color: var(--color-text-secondary, #888);">${t.description}</div>` : ''}
                </div>
                <div style="
                    background: ${borderColors[idx % borderColors.length]};
                    color: #000;
                    padding: 8px 16px;
                    border-radius: 25px;
                    font-weight: 700;
                    font-size: 1rem;
                ">${t.price > 0 ? `₹${t.price}` : 'FREE'}</div>
            </div>
        `}).join('');

        // Price summary for header
        const minPrice = Math.min(...ticketTypes.map(t => t.price));
        const maxPrice = Math.max(...ticketTypes.map(t => t.price));
        const priceRange = minPrice === maxPrice
            ? (minPrice > 0 ? `₹${minPrice}` : 'Free')
            : `₹${minPrice} - ₹${maxPrice}`;

        eventContainer.innerHTML = `
            <div class="event-detail-header">
                <img src="${imageUrl}" alt="${item.title}" class="event-detail-image">
                <div class="event-detail-badge">Event</div>
            </div>

            <div class="event-detail-content">
                <h1 class="event-detail-title">${item.title}</h1>

                <div class="event-meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Date</span>
                        <span class="meta-value">${dateStr}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Location</span>
                        <span class="meta-value">${item.location || 'TBA'}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Starting From</span>
                        <span class="meta-value" style="color: var(--color-accent, #eabd08); font-weight: 600;">${priceRange}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Capacity</span>
                        <span class="meta-value">${slotsDisplay}</span>
                    </div>
                </div>

                <!-- Premium Ticket Types Section -->
                ${ticketTypes.length > 1 ? `
                <div class="ticket-types-section" style="margin: 2rem 0;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                        <span style="font-size: 1.5rem;">🎟️</span>
                        <h3 style="font-size: 1.25rem; font-weight: 600; color: var(--color-text, #fff); margin: 0;">Choose Your Ticket</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        ${ticketTypesHtml}
                    </div>
                </div>
                ` : ''}

                ${item.external_link
                ? `<p class="event-address">
                               <a href="${item.external_link}" target="_blank">External Link ↗</a>
                           </p>`
                : ''
            }

                <div class="event-description">
                    <h3>About this Event</h3>
                    <p>${item.description || 'No description available.'}</p>
                </div>

                <div class="event-actions">
                    <a id="book-btn" href="/book.html?id=${item.id}" class="btn btn-primary">
                        Book Tickets
                    </a>
                </div>
            </div>
        `;

        // Promo Code Logic (only if elements exist)
        const promoInput = document.getElementById('promo-code');
        const applyBtn = document.getElementById('apply-code-btn');
        const promoMsg = document.getElementById('promo-message');
        const discountRow = document.getElementById('discount-row');
        const discountPercentEl = document.getElementById('discount-percent');
        const discountAmountEl = document.getElementById('discount-amount');
        const finalTotalEl = document.getElementById('final-total');
        const bookBtn = document.getElementById('book-btn');

        if (!applyBtn || !promoInput) return;

        let currentPrice = item.price;
        let appliedCode = '';

        applyBtn.addEventListener('click', async () => {
            const code = promoInput.value.trim();
            if (!code) return;

            applyBtn.textContent = 'Checking...';
            applyBtn.disabled = true;
            promoMsg.textContent = '';
            promoMsg.className = 'promo-message';

            try {
                const res = await fetch('/api/validate-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });

                const data = await res.json();

                if (res.ok && data.valid) {
                    const discount = (item.price * data.discountPercent) / 100;
                    const newTotal = Math.max(0, item.price - discount);

                    discountRow.style.display = 'flex';
                    discountPercentEl.textContent = data.discountPercent;
                    discountAmountEl.textContent = Math.round(discount);
                    finalTotalEl.textContent = Math.round(newTotal);

                    promoMsg.textContent = `Code '${code}' applied! You saved ${data.discountPercent}%`;
                    promoMsg.classList.add('success');

                    bookBtn.href = `/book.html?id=${item.id}&code=${code}`;

                    appliedCode = code;
                    currentPrice = newTotal;
                } else {
                    throw new Error(data.error || 'Invalid code');
                }
            } catch (err) {
                promoMsg.textContent = err.message;
                promoMsg.classList.add('error');

                discountRow.style.display = 'none';
                finalTotalEl.textContent = item.price;
                bookBtn.href = `/book.html?id=${item.id}`;
            } finally {
                applyBtn.textContent = 'Apply';
                applyBtn.disabled = false;
            }
        });
    }

    function renderError(msg) {
        eventContainer.innerHTML = `
            <div class="error-state">
                <h3>${msg}</h3>
                <a href="/" class="btn btn-outline" style="margin-top: 1rem;">
                    Back to Events
                </a>
            </div>
        `;
    }
});
