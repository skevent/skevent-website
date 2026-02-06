import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Sticky Header ---
    const header = document.querySelector('.header');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        if (header) {
            header.classList.toggle('scrolled', currentScrollY > 50);
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
            }
        }
        lastScrollY = currentScrollY;
    });

    // --- Mobile Menu ---
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.classList.toggle('is-active');
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                menuToggle.classList.remove('is-active');
            });
        });
    }

    // --- Auth State Management ---
    // --- Auth State Management ---
    const updateAuthUI = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const navList = document.querySelector('.nav-list');
        // We now have a container for header buttons
        const authButtons = document.getElementById('auth-buttons');
        // Also keep the mobile nav link if it exists
        const mobileLoginLink = document.getElementById('login-link');

        if (session) {
            // 1. Clean up Auth Buttons (Hide Login/SignUp)
            if (authButtons) {
                // Hide only the specific login/signup links/buttons
                const authLinks = authButtons.querySelectorAll('.nav-link, .btn-primary');
                authLinks.forEach(link => {
                    // Don't hide the profile trigger or menu items if we accidentally match them
                    if (!link.classList.contains('profile-trigger') && !link.classList.contains('menu-item')) {
                        link.style.display = 'none';
                    }
                });
            }
            if (mobileLoginLink) mobileLoginLink.style.display = 'none';

            // Fetch Profile (Role, Name, Avatar)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', session.user.id)
                .single();

            if (profileError) {
                console.warn('⚠️ Profile Fetch Error (Expected for new users):', profileError.message);
            }

            console.log('👤 profile query result:', {
                id: session.user.id,
                role: profile?.role,
                full_name: profile?.full_name
            });

            // Add Profile/Dashboard Dropdown if not present
            if (!document.getElementById('profile-menu-container')) {
                const container = document.createElement('div');
                container.id = 'profile-menu-container';
                container.className = 'profile-dropdown-container'; // Updated class

                // Determine Name & Initials
                const displayName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User';
                const firstName = displayName.split(' ')[0];
                const initials = (firstName || 'U').charAt(0).toUpperCase();
                const avatarUrl = profile?.avatar_url; // Will be undefined, which is fine

                // Dashboard Link Logic
                // If profile query fails, we might still have the role in user metadata (if updated) 
                // but checking DB is safer. Let's fallback to 'user' if query failed.
                const userRole = profile?.role || 'user';
                const canAccessDashboard = ['admin', 'influencer', 'pending_influencer'].includes(userRole);
                const dashboardUrl = userRole === 'admin' ? '/admin/index.html' : '/influencer/index.html';

                container.innerHTML = `
                    <button class="profile-trigger" id="profile-trigger" aria-expanded="false">
                        <div class="profile-avatar">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar">` : initials}
                        </div>
                        <span class="profile-name">
                            ${firstName} 
                            <span class="dropdown-arrow">▼</span>
                        </span>
                    </button>
                    
                    <div class="profile-dropdown-menu" id="dropdown-menu">
                        <div class="profile-menu-header">
                            <div class="profile-avatar">
                                ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar">` : initials}
                            </div>
                            <div class="profile-info">
                                <span class="name">${displayName}</span>
                                <span class="role">${userRole || 'User'}</span>
                            </div>
                        </div>
                        
                        <div class="menu-divider"></div>
                        
                        ${canAccessDashboard ?
                        `<a href="${dashboardUrl}" class="menu-item link-dashboard">Dashboard</a>`
                        : ''}
                            
                        <button id="logout-btn" class="menu-item sign-out">Sign Out</button>
                    </div>
                `;

                // Append to Header CTA (Right Side)
                if (authButtons) authButtons.insertBefore(container, authButtons.lastElementChild);

                // Dropdown Interaction Logic
                const trigger = document.getElementById('profile-trigger');
                const menu = document.getElementById('dropdown-menu');
                const logoutBtn = document.getElementById('logout-btn');

                // Toggle Open/Close
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
                    trigger.setAttribute('aria-expanded', !isExpanded);
                    menu.classList.toggle('active');
                });

                // Close when clicking outside
                document.addEventListener('click', (e) => {
                    if (!container.contains(e.target)) {
                        menu.classList.remove('active');
                        trigger.setAttribute('aria-expanded', 'false');
                    }
                });

                // Close when clicking an item
                menu.querySelectorAll('.menu-item').forEach(item => {
                    item.addEventListener('click', () => {
                        menu.classList.remove('active');
                        trigger.setAttribute('aria-expanded', 'false');
                    });
                });

                // Logout Logic
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async () => {
                        await supabase.auth.signOut();
                        window.location.href = '/'; // Redirect to home
                    });
                }
            }
        } else {
            // Logged Out: Show Auth Buttons
            if (authButtons) {
                const links = authButtons.querySelectorAll('a');
                links.forEach(link => link.style.display = ''); // Reset to default (inline/block)
            }
            if (mobileLoginLink) mobileLoginLink.style.display = 'block';

            const profileMenu = document.getElementById('profile-menu-container');
            if (profileMenu) profileMenu.remove();
        }
    };
    updateAuthUI();

    // --- Scroll Animations ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

    // --- Upcoming Events Fetcher (Supabase) ---
    const eventsContainer = document.getElementById('events-container');

    if (eventsContainer) {
        try {
            const { data: events, error } = await supabase
                .from('events')
                .select('*')
                .gte('date', new Date().toISOString())
                .order('date', { ascending: true })
                .limit(4);

            if (error) throw error;

            if (!events || events.length === 0) {
                eventsContainer.innerHTML = '<div class="empty-state"><p>No upcoming events found.</p></div>';
            } else {
                eventsContainer.innerHTML = '';
                events.forEach((event, index) => {
                    const dateObj = new Date(event.date);
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const delay = index * 0.1;
                    const imageUrl = event.image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80';

                    const card = document.createElement('div');
                    card.className = 'event-card';
                    card.style.animationDelay = `${delay}s`;

                    card.innerHTML = `
                        <a href="/event.html?id=${event.id}" class="event-image-link">
                            <img src="${imageUrl}" alt="${event.title}" loading="lazy">
                        </a>
                        <div class="event-details">
                            <h3 class="event-title">${event.title}</h3>
                            <p class="event-date">${dateStr}</p>
                            <p class="event-location">📍 ${event.location || 'TBA'}</p>
                        </div>
                    `;
                    eventsContainer.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Error fetching events:', err);
            eventsContainer.innerHTML = '<div class="error-state"><p>Unable to load events.</p></div>';
        }
    }

    // --- Featured Events (Supabase) ---
    const portfolioContainer = document.getElementById('portfolio-container');
    if (portfolioContainer) {
        try {
            // Try fetching featured events via relationship or filtered events
            let items = [];

            // First try to see if 'featured_events' table access works
            const { data: featuredData, error: featuredError } = await supabase
                .from('featured_events')
                .select('*, events(title, image_url, date)')
                .order('display_order', { ascending: true });

            if (!featuredError && featuredData && featuredData.length > 0) {
                items = featuredData.map(f => f.events);
            } else {
                // Fallback: Get past events
                const { data: pastEvents } = await supabase
                    .from('events')
                    .select('*')
                    .lt('date', new Date().toISOString())
                    .limit(3);
                items = pastEvents || [];
            }

            if (!items || items.length === 0) {
                portfolioContainer.innerHTML = '<p class="text-muted text-center">More work coming soon.</p>';
            } else {
                portfolioContainer.innerHTML = '';
                items.forEach((item, index) => {
                    if (!item) return;
                    const imageUrl = item.image_url || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80';
                    const delay = index * 0.15;

                    const card = document.createElement('div');
                    card.className = 'portfolio-item';
                    card.style.animation = `fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards ${delay}s`;
                    card.style.opacity = '0'; // Start hidden for animation

                    card.innerHTML = `
                        <img src="${imageUrl}" alt="${item.title}" loading="lazy">
                        <div class="portfolio-overlay">
                            <h3 class="portfolio-title">${item.title}</h3>
                        </div>
                    `;
                    portfolioContainer.appendChild(card);
                });
            }

        } catch (err) {
            console.error('Error fetching portfolio:', err);
        }
    }

    // --- Influencers (Supabase) ---
    const influencersContainer = document.getElementById('influencers-container');
    if (influencersContainer) {
        try {
            const { data: influencers, error } = await supabase
                .from('influencers')
                .select('*')
                .eq('active', true); // Assuming column is 'active' or 'is_active'. Database.md says `active` (bool) but then later `is_active` (boolean). Let's check Schema.
            // Database.md #4 Influencers columns: `is_active` (boolean).
            // Database.md also says "code (text) ... active (bool)". It's inconsistent.
            // "is_active" was used in create-razorpay-order.js. I'll stick with `is_active` OR try both if unsure, but let's assume `is_active` based on #4 definition.

            // Wait, I should verify the column name. Step 5 says:
            // * `is_active` (boolean)

            // Retrying fetch with correct column
            const { data: influencersCorrect, error: errorCorrect } = await supabase
                .from('influencers')
                .select('*, profiles(full_name)')
                .eq('active', true);

            if (errorCorrect) throw errorCorrect;

            if (!influencersCorrect || influencersCorrect.length === 0) {
                influencersContainer.innerHTML = '<p class="text-muted text-center">Join our network.</p>';
            } else {
                influencersContainer.innerHTML = '';
                influencersCorrect.forEach((item, index) => {
                    const imageUrl = item.image_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
                    const delay = index * 0.1;

                    const card = document.createElement('div');
                    card.className = 'influencer-card';
                    card.style.animation = `fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards ${delay}s`;
                    card.style.opacity = '0';

                    let socialHtml = '';
                    if (item.instagram) socialHtml += `<a href="${item.instagram}" target="_blank" class="social-icon insta"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" alt="Insta"></a>`;
                    if (item.facebook) socialHtml += `<a href="${item.facebook}" target="_blank" class="social-icon fb"><img src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg" alt="FB"></a>`;
                    if (item.youtube) socialHtml += `<a href="${item.youtube}" target="_blank" class="social-icon yt"><img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" alt="YT"></a>`;

                    const displayName = item.name || item.profiles?.full_name || 'Influencer';

                    card.innerHTML = `
                        <div class="influencer-img-wrapper">
                            <img src="${imageUrl}" alt="${displayName}" loading="lazy">
                        </div>
                        <h3 class="influencer-name">${displayName}</h3>
                        <div class="influencer-contact social-links">
                            ${socialHtml || '<span class="text-muted" style="font-size:0.8rem;">Socials coming soon</span>'}
                        </div>
                    `;
                    influencersContainer.appendChild(card);
                });
            }
        } catch (err) {
            console.error('Influencer fetch error:', err);
        }
    }
    // --- Contact Form Handling ---
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;

            // Collect Form Data
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            try {
                btn.textContent = 'Sending...';
                btn.disabled = true;

                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) throw new Error(result.error || 'Failed to send message');

                // Success Feedback
                btn.textContent = 'Message Sent! ✅';
                btn.style.background = '#10B981'; // Success Green
                contactForm.reset();

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);

            } catch (err) {
                console.error('Contact Form Error:', err);
                btn.textContent = 'Failed. Try Again.';
                btn.style.background = '#EF4444'; // Error Red

                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            }
        });
    }
});
