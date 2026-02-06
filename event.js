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

        renderEvent(event);
    } catch (err) {
        console.error('Error fetching event:', err);
        renderError('Event not found or unavailable.');
    }

    function renderEvent(item) {
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

        const priceDisplay = item.price > 0 ? `₹${item.price}` : 'Free';
        const slotsDisplay = item.capacity ? `${item.capacity} Spots` : 'Open Entry';

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
                        <span class="meta-label">Price</span>
                        <span class="meta-value">${priceDisplay}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Capacity</span>
                        <span class="meta-value">${slotsDisplay}</span>
                    </div>
                </div>

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
