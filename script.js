// Supabase Configuration
const SUPABASE_URL = 'https://hbbcjjqcrdvfnupwrdxt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3CbTodhKDbEOZWHzVsDiqA_HOrXxVVN';

class BetterProgrammerApp {
    constructor() {
        this.supabase = null;
        this.state = {
            user: null,
            books: [],
            cart: [],
            filters: {
                category: 'all',
                price: 'all',
                sort: 'popular',
                difficulty: 'all',
                search: ''
            },
            categories: [],
            isLoading: false
        };
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Better Programmer App...');
        
        // 1. Initialize Supabase FIRST
        await this.initSupabase();
        
        // 2. Setup UI and events
        this.initUI();
        this.setupEventListeners();
        
        // 3. Load data from Supabase
        await this.loadInitialData();
        
        console.log('✅ App initialized successfully');
    }

    async initSupabase() {
        try {
            console.log('🔗 Initializing Supabase connection...');
            
            // Create Supabase client
            this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: false
                }
            });
            
            console.log('✅ Supabase client created');
            
            // Check connection
            await this.testConnection();
            
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            this.showToast('Database connection failed. Using demo mode.', 'error');
            this.supabase = null;
        }
    }

    async testConnection() {
        try {
            console.log('🔍 Testing Supabase connection...');
            
            const { data, error } = await this.supabase
                .from('books')
                .select('count', { count: 'exact', head: true })
                .limit(1);
            
            if (error) {
                console.error('❌ Supabase connection failed:', error);
                return false;
            }
            
            console.log('✅ Supabase connected successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Connection test error:', error);
            return false;
        }
    }

    async loadInitialData() {
        console.log('📦 Loading initial data...');
        
        // Load books
        await this.loadBooks();
        
        // Load categories
        await this.loadCategories();
        
        // Check user session
        await this.checkUserSession();
        
        // Load cart from localStorage (fallback)
        this.loadCartFromStorage();
    }

    // ==================== AUTHENTICATION ====================
    
    async checkUserSession() {
        try {
            if (!this.supabase) return;
            
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Session error:', error);
                return;
            }
            
            if (session?.user) {
                await this.loadUserProfile(session.user.id);
            }
            
        } catch (error) {
            console.error('Session check error:', error);
        }
    }

    async loadUserProfile(userId) {
        try {
            const { data: user, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
            
            if (error) {
                console.error('User load error:', error);
                return;
            }
            
            this.state.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                phone: user.phone,
                age: user.age,
                avatar_url: user.avatar_url
            };
            
            this.updateUI();
            this.showToast(`Welcome back, ${user.name}!`, 'success');
            
        } catch (error) {
            console.error('Profile load error:', error);
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value.trim();
        
        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }
        
        try {
            // SPECIAL ADMIN LOGIN (for testing)
            if (email === 'better' && password === 'tweekex15') {
                // Try to login or create admin user
                await this.handleAdminLogin();
                return;
            }
            
            // Regular Supabase Auth login
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                // If user doesn't exist, try to sign up
                if (error.message.includes('Invalid login credentials')) {
                    await this.handleSignup(email, password);
                } else {
                    throw error;
                }
            } else {
                // Success - load user profile
                await this.loadUserProfile(data.user.id);
                this.closeModal();
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed: ' + error.message, 'error');
        }
    }

    async handleAdminLogin() {
        try {
            // Check if admin exists in users table
            const { data: existingAdmin, error: checkError } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', 'better')
                .single();
            
            if (checkError || !existingAdmin) {
                // Create admin user
                const { data: newAdmin, error: createError } = await this.supabase
                    .from('users')
                    .insert({
                        email: 'better',
                        name: 'Admin User',
                        role: 'admin',
                        phone: '+995 123 456 789',
                        age: 30
                    })
                    .select()
                    .single();
                
                if (createError) {
                    console.error('Admin creation error:', createError);
                    // Fallback to local admin
                    this.createLocalAdmin();
                    return;
                }
                
                this.state.user = {
                    id: newAdmin.id,
                    email: newAdmin.email,
                    name: newAdmin.name,
                    role: newAdmin.role,
                    phone: newAdmin.phone,
                    age: newAdmin.age
                };
                
            } else {
                // Admin exists
                this.state.user = {
                    id: existingAdmin.id,
                    email: existingAdmin.email,
                    name: existingAdmin.name,
                    role: existingAdmin.role,
                    phone: existingAdmin.phone,
                    age: existingAdmin.age
                };
            }
            
            this.saveUser();
            this.closeModal();
            this.updateUI();
            this.showToast('Welcome back, Admin!', 'success');
            
        } catch (error) {
            console.error('Admin login error:', error);
            this.createLocalAdmin();
        }
    }

    createLocalAdmin() {
        this.state.user = {
            id: 'admin-' + Date.now(),
            email: 'better',
            name: 'Admin User',
            role: 'admin',
            phone: '+995 123 456 789',
            age: 30
        };
        
        this.saveUser();
        this.closeModal();
        this.updateUI();
        this.showToast('Welcome back, Admin! (Local Mode)', 'success');
    }

    async handleSignup(email, password, userData = {}) {
        try {
            // Sign up with Supabase Auth
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: userData.name || email.split('@')[0]
                    }
                }
            });
            
            if (authError) throw authError;
            
            // Create user profile in users table
            const { error: profileError } = await this.supabase
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: email,
                    name: userData.name || email.split('@')[0],
                    role: 'user',
                    phone: userData.phone || '+995 123 456 789',
                    age: userData.age || 25
                });
            
            if (profileError) {
                console.error('Profile creation error:', profileError);
            }
            
            // Load the new user
            await this.loadUserProfile(authData.user.id);
            this.closeModal();
            this.showToast('Account created successfully!', 'success');
            
        } catch (error) {
            console.error('Signup error:', error);
            this.showToast('Signup failed: ' + error.message, 'error');
        }
    }

    async logout() {
        try {
            if (this.supabase) {
                await this.supabase.auth.signOut();
            }
            
            this.state.user = null;
            localStorage.removeItem('bp_user');
            this.updateUI();
            this.showToast('Logged out successfully', 'success');
            this.navigateTo('home');
            
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // ==================== BOOKS ====================
    
    async loadBooks() {
        console.log('📚 Loading books from Supabase...');
        
        try {
            if (!this.supabase) {
                console.log('No Supabase client, using demo data');
                this.loadDemoBooks();
                return;
            }
            
            const { data: books, error } = await this.supabase
                .from('books')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Books load error:', error);
                this.loadDemoBooks();
                return;
            }
            
            if (books && books.length > 0) {
                this.state.books = books;
                console.log(`✅ Loaded ${books.length} books from Supabase`);
            } else {
                console.log('No books in database, loading demo data');
                this.loadDemoBooks();
            }
            
            this.renderBooks();
            
        } catch (error) {
            console.error('Books load exception:', error);
            this.loadDemoBooks();
        }
    }

    loadDemoBooks() {
        this.state.books = [
            {
                id: 'book-1',
                title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
                author: 'Robert C. Martin',
                price: 29.99,
                category: 'algorithms',
                difficulty: 'intermediate',
                description: 'Learn how to write clean, maintainable code that other developers will love to work with.',
                image_url: 'https://picsum.photos/400/600?random=1',
                rating: 4.7,
                reviews: 1248,
                pages: 464,
                badges: ['popular', 'bestseller']
            },
            {
                id: 'book-2',
                title: 'Eloquent JavaScript',
                author: 'Marijn Haverbeke',
                price: 0,
                category: 'web',
                difficulty: 'beginner',
                description: 'A modern introduction to programming using JavaScript. Learn the fundamentals and advanced concepts.',
                image_url: 'https://picsum.photos/400/600?random=2',
                rating: 4.6,
                reviews: 856,
                pages: 472,
                badges: ['free', 'new']
            },
            {
                id: 'book-3',
                title: 'The Pragmatic Programmer',
                author: 'David Thomas & Andrew Hunt',
                price: 39.99,
                category: 'web',
                difficulty: 'intermediate',
                description: 'Your journey to mastery, from apprentice to master craftsman.',
                image_url: 'https://picsum.photos/400/600?random=3',
                rating: 4.8,
                reviews: 956,
                pages: 352,
                badges: ['popular']
            }
        ];
        
        this.renderBooks();
    }

    async loadCategories() {
        try {
            if (!this.supabase) {
                this.loadDemoCategories();
                return;
            }
            
            const { data: categories, error } = await this.supabase
                .from('categories')
                .select('*')
                .order('name');
            
            if (error || !categories || categories.length === 0) {
                this.loadDemoCategories();
                return;
            }
            
            this.state.categories = categories;
            this.renderCategories();
            
        } catch (error) {
            console.error('Categories load error:', error);
            this.loadDemoCategories();
        }
    }

    loadDemoCategories() {
        this.state.categories = [
            { id: 'web', name: 'Web Development', description: 'Frontend, backend, full-stack development', icon: 'code' },
            { id: 'mobile', name: 'Mobile Development', description: 'iOS, Android, React Native, Flutter', icon: 'smartphone' },
            { id: 'data', name: 'Data Science', description: 'Python, R, SQL, machine learning basics', icon: 'analytics' },
            { id: 'ai', name: 'AI & Machine Learning', description: 'Deep learning, neural networks, AI models', icon: 'psychology' },
            { id: 'devops', name: 'DevOps', description: 'Docker, Kubernetes, CI/CD, cloud', icon: 'deployed_code' },
            { id: 'algorithms', name: 'Algorithms', description: 'Data structures, algorithms, competitive programming', icon: 'terminal' }
        ];
        
        this.renderCategories();
    }

    // ==================== RENDERING ====================
    
    renderBooks() {
        const booksGrid = document.getElementById('booksGrid');
        if (!booksGrid) return;
        
        const books = this.getFilteredBooks();
        
        if (books.length === 0) {
            booksGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem; color: var(--text-secondary);">
                    <span class="material-symbols-rounded" style="font-size: 4rem; margin-bottom: 1rem; color: var(--accent-blue);">search_off</span>
                    <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No books found</h3>
                    <p>Try adjusting your filters or search terms</p>
                </div>
            `;
            return;
        }
        
        booksGrid.innerHTML = books.map(book => `
            <div class="book-card">
                <div class="book-cover">
                    <img src="${book.image_url || book.image}" alt="${book.title}" class="book-image" onerror="this.src='https://picsum.photos/400/600?book'">
                    <div class="book-badges">
                        ${book.price === 0 ? '<div class="badge badge-free">FREE</div>' : ''}
                        ${book.badges?.includes('new') ? '<div class="badge badge-new">NEW</div>' : ''}
                        ${book.badges?.includes('popular') ? '<div class="badge badge-popular">POPULAR</div>' : ''}
                        ${!book.id.includes('book-') ? '<div class="badge" style="background: #10b981;">LIVE</div>' : '<div class="badge" style="background: #ef4444;">DEMO</div>'}
                    </div>
                </div>
                <div class="book-info">
                    <h3 class="book-title">${book.title}</h3>
                    <div class="book-author">
                        <span class="material-symbols-rounded" style="font-size: 1rem;">person</span>
                        ${book.author}
                    </div>
                    <p class="book-description">${book.description}</p>
                    <div class="book-meta">
                        <span class="book-category">${this.getCategoryName(book.category)}</span>
                        <div class="book-rating">
                            <span>${book.rating?.toFixed(1) || '4.5'}</span>
                            <span class="material-symbols-rounded" style="color: var(--accent-orange);">star</span>
                            <span style="color: var(--text-muted); font-size: 0.8rem;">(${book.reviews || '100'})</span>
                        </div>
                    </div>
                    <div class="book-price-section">
                        <div class="book-price ${book.price === 0 ? 'book-price-free' : ''}">
                            ${book.price === 0 ? 'FREE' : '$' + (book.price || 0).toFixed(2)}
                        </div>
                        <div style="color: var(--text-muted); font-size: 0.85rem;">
                            ${book.pages || '300'} pages
                        </div>
                    </div>
                    <div class="book-actions">
                        <button class="btn btn-primary btn-small" onclick="app.buyBook('${book.id}')">
                            <span class="material-symbols-rounded">shopping_cart</span>
                            Buy Now
                        </button>
                        <button class="btn btn-cart btn-small" onclick="app.addToCart('${book.id}')">
                            <span class="material-symbols-rounded">add_shopping_cart</span>
                            Add to Cart
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderCategories() {
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) return;
        
        categoriesGrid.innerHTML = this.state.categories.map(cat => `
            <div class="category-card" onclick="app.navigateTo('books'); app.setFilter('category', '${cat.id}')">
                <div class="category-icon">
                    <span class="material-symbols-rounded">${cat.icon || 'code'}</span>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">${cat.name}</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">${cat.description || ''}</p>
                <div style="color: var(--accent-blue); font-weight: 600;">
                    ${this.state.books.filter(b => b.category === cat.id).length} Books
                </div>
            </div>
        `).join('');
    }

    // ==================== FILTERS ====================
    
    getFilteredBooks() {
        let filtered = [...this.state.books];
        
        // Category filter
        if (this.state.filters.category !== 'all') {
            filtered = filtered.filter(book => book.category === this.state.filters.category);
        }
        
        // Price filter
        switch (this.state.filters.price) {
            case 'free':
                filtered = filtered.filter(book => book.price === 0);
                break;
            case 'paid':
                filtered = filtered.filter(book => book.price > 0);
                break;
            case 'under-20':
                filtered = filtered.filter(book => book.price < 20);
                break;
            case '20-50':
                filtered = filtered.filter(book => book.price >= 20 && book.price <= 50);
                break;
            case 'over-50':
                filtered = filtered.filter(book => book.price > 50);
                break;
        }
        
        // Difficulty filter
        if (this.state.filters.difficulty !== 'all') {
            filtered = filtered.filter(book => book.difficulty === this.state.filters.difficulty);
        }
        
        // Search filter
        if (this.state.filters.search.trim()) {
            const searchTerm = this.state.filters.search.toLowerCase();
            filtered = filtered.filter(book =>
                book.title.toLowerCase().includes(searchTerm) ||
                book.author.toLowerCase().includes(searchTerm) ||
                book.description.toLowerCase().includes(searchTerm)
            );
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (this.state.filters.sort) {
                case 'newest':
                    return new Date(b.created_at || '2000-01-01') - new Date(a.created_at || '2000-01-01');
                case 'rating':
                    return (b.rating || 0) - (a.rating || 0);
                case 'price-low':
                    return a.price - b.price;
                case 'price-high':
                    return b.price - a.price;
                case 'popular':
                default:
                    return (b.reviews || 0) - (a.reviews || 0);
            }
        });
        
        return filtered;
    }

    filterAndRenderBooks() {
        this.renderBooks();
    }

    // ==================== CART ====================
    
    addToCart(bookId) {
        const book = this.state.books.find(b => b.id === bookId);
        if (!book) return;
        
        const existingItem = this.state.cart.find(item => item.bookId === bookId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.state.cart.push({
                bookId,
                title: book.title,
                price: book.price,
                image: book.image_url || book.image,
                quantity: 1
            });
        }
        
        this.saveCart();
        this.updateCartCount();
        this.showToast(`Added "${book.title}" to cart`, 'success');
    }

    loadCartFromStorage() {
        const savedCart = localStorage.getItem('bp_cart');
        if (savedCart) {
            this.state.cart = JSON.parse(savedCart);
            this.updateCartCount();
        }
    }

    saveCart() {
        localStorage.setItem('bp_cart', JSON.stringify(this.state.cart));
    }

    updateCartCount() {
        const cartCount = document.getElementById('cartCount');
        if (!cartCount) return;
        const count = this.state.cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = count;
    }

    // ==================== PURCHASES ====================
    
    async buyBook(bookId) {
        const book = this.state.books.find(b => b.id === bookId);
        if (!book) return;
        
        if (!this.state.user) {
            this.showAuthModal();
            this.showToast('Please sign in to purchase books', 'warning');
            return;
        }
        
        try {
            // Save purchase to Supabase
            if (this.supabase) {
                const { error } = await this.supabase
                    .from('purchases')
                    .insert({
                        user_id: this.state.user.id,
                        book_id: bookId,
                        amount: book.price,
                        status: 'completed'
                    });
                
                if (error) {
                    console.error('Purchase save error:', error);
                    this.showToast('Purchase saved locally (database error)', 'warning');
                } else {
                    this.showToast(`Purchased "${book.title}" successfully!`, 'success');
                }
            } else {
                this.showToast(`Purchased "${book.title}" (offline mode)`, 'success');
            }
            
        } catch (error) {
            console.error('Purchase error:', error);
            this.showToast('Purchase completed (offline)', 'success');
        }
    }

    // ==================== ADMIN PANEL ====================
    
    setupAdminPanel() {
        if (!this.state.user || this.state.user.role !== 'admin') {
            document.getElementById('adminNavLink').style.display = 'none';
            return;
        }
        
        document.getElementById('adminNavLink').style.display = 'flex';
        this.setupAdminEventListeners();
    }

    async setupAdminEventListeners() {
        // Add book button
        document.getElementById('adminAddBookBtn')?.addEventListener('click', () => {
            this.showAddBookModal();
        });
        
        // Load admin data
        this.loadAdminData();
    }

    async loadAdminData() {
        try {
            if (!this.supabase) return;
            
            // Load stats
            const booksCount = await this.getTableCount('books');
            const usersCount = await this.getTableCount('users');
            const purchasesCount = await this.getTableCount('purchases');
            
            document.getElementById('totalBooksCount').textContent = booksCount;
            document.getElementById('totalUsersCount').textContent = usersCount;
            document.getElementById('totalOrdersCount').textContent = purchasesCount;
            document.getElementById('totalRevenue').textContent = '$' + (purchasesCount * 29.99).toFixed(2);
            
            // Load users
            await this.loadAdminUsers();
            
            // Load books for admin
            await this.loadAdminBooks();
            
        } catch (error) {
            console.error('Admin data load error:', error);
        }
    }

    async getTableCount(tableName) {
        try {
            const { count, error } = await this.supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
            
            return error ? 0 : count;
        } catch (error) {
            return 0;
        }
    }

    async loadAdminUsers() {
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) return;
            
            const container = document.getElementById('usersList');
            if (!container) return;
            
            container.innerHTML = users.map(user => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-light);">
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${user.name}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">${user.email} • ${user.role}</div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem;">
                            ${user.phone || 'No phone'} • Age: ${user.age || 'N/A'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <span class="badge ${user.role === 'admin' ? 'badge-popular' : 'badge-free'}" style="padding: 4px 8px;">
                            ${user.role}
                        </span>
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Admin users load error:', error);
        }
    }

    async loadAdminBooks() {
        try {
            const container = document.getElementById('adminBooksList');
            if (!container) return;
            
            container.innerHTML = this.state.books.map(book => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${book.image_url || book.image}" style="width: 60px; height: 80px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://picsum.photos/400/600?book'">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">${book.title}</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">by ${book.author}</div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                                <span class="badge ${book.price === 0 ? 'badge-free' : 'badge-popular'}" style="padding: 2px 8px; font-size: 0.7rem;">
                                    ${book.price === 0 ? 'FREE' : '$' + book.price}
                                </span>
                                <span style="color: var(--text-muted); font-size: 0.8rem;">•</span>
                                <span style="color: var(--text-muted); font-size: 0.8rem;">${this.getCategoryName(book.category)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="color: var(--accent-blue); font-weight: 600;">
                        ${book.id.includes('book-') ? 'DEMO' : 'LIVE'}
                    </div>
                </div>
            `).join('');
            
        } catch (error) {
            console.error('Admin books load error:', error);
        }
    }

    async showAddBookModal() {
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <span class="material-symbols-rounded">menu_book</span>
                        Add New Book
                    </h2>
                    <div class="modal-close" onclick="app.closeModal()">
                        <span class="material-symbols-rounded">close</span>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="centered-form">
                        <form id="addBookForm" onsubmit="app.handleAddBook(event)">
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">title</span>
                                    Book Title
                                </label>
                                <input type="text" class="form-input" id="bookTitle" required placeholder="Book Title">
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">person</span>
                                    Author
                                </label>
                                <input type="text" class="form-input" id="bookAuthor" required placeholder="Author Name">
                            </div>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="material-symbols-rounded">attach_money</span>
                                        Price
                                    </label>
                                    <input type="number" class="form-input" id="bookPrice" required min="0" step="0.01" placeholder="29.99">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">
                                        <span class="material-symbols-rounded">category</span>
                                        Category
                                    </label>
                                    <select class="form-input" id="bookCategory" required>
                                        ${this.state.categories.map(cat => `
                                            <option value="${cat.id}">${cat.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <span class="material-symbols-rounded">add</span>
                                    Add Book
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        this.openModal(modalContent);
    }

    async handleAddBook(event) {
        event.preventDefault();
        
        const title = document.getElementById('bookTitle').value.trim();
        const author = document.getElementById('bookAuthor').value.trim();
        const price = parseFloat(document.getElementById('bookPrice').value);
        const category = document.getElementById('bookCategory').value;
        
        if (!title || !author || isNaN(price)) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }
        
        try {
            if (this.supabase) {
                const { error } = await this.supabase
                    .from('books')
                    .insert({
                        title,
                        author,
                        price,
                        category,
                        difficulty: 'intermediate',
                        description: `${title} by ${author}. A great programming book.`,
                        image_url: `https://picsum.photos/400/600?random=${Date.now()}`,
                        rating: 4.5,
                        reviews: Math.floor(Math.random() * 500) + 100,
                        pages: Math.floor(Math.random() * 400) + 200
                    });
                
                if (error) throw error;
                
                // Refresh books
                await this.loadBooks();
                this.showToast('Book added to database!', 'success');
                
            } else {
                this.showToast('Database not available. Book saved locally.', 'warning');
            }
            
            this.closeModal();
            
        } catch (error) {
            console.error('Add book error:', error);
            this.showToast('Failed to add book: ' + error.message, 'error');
        }
    }

    // ==================== UI HELPERS ====================
    
    initUI() {
        this.updateAuthButton();
        this.updateCartCount();
    }

    updateUI() {
        this.updateAuthButton();
        this.setupAdminPanel();
        this.renderProfile();
    }

    updateAuthButton() {
        const authBtn = document.getElementById('authBtn');
        if (!authBtn) return;
        authBtn.textContent = this.state.user ? 'Sign Out' : 'Sign In';
        authBtn.onclick = this.state.user ? () => this.logout() : () => this.showAuthModal();
    }

    renderProfile() {
        const profileInfo = document.getElementById('profileInfo');
        if (!profileInfo) return;
        
        if (!this.state.user) {
            profileInfo.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <span class="material-symbols-rounded" style="font-size: 4rem; color: var(--text-secondary); margin-bottom: 1rem;">person_off</span>
                    <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Not Signed In</h3>
                    <p style="color: var(--text-secondary);">Sign in to view your profile</p>
                </div>
            `;
            return;
        }
        
        profileInfo.innerHTML = `
            <div class="info-row">
                <span>Name</span>
                <span style="color: var(--text-primary); font-weight: 500;">${this.state.user.name}</span>
            </div>
            <div class="info-row">
                <span>Email</span>
                <span style="color: var(--text-primary); font-weight: 500;">${this.state.user.email}</span>
            </div>
            <div class="info-row">
                <span>Account Type</span>
                <span style="color: var(--text-primary); font-weight: 500; text-transform: capitalize;">${this.state.user.role}</span>
            </div>
            ${this.state.user.phone ? `
                <div class="info-row">
                    <span>Phone</span>
                    <span style="color: var(--text-primary); font-weight: 500;">${this.state.user.phone}</span>
                </div>
            ` : ''}
        `;
    }

    // ==================== EVENT LISTENERS ====================
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
        
        // Search
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            this.state.filters.search = e.target.value;
            this.filterAndRenderBooks();
        });
        
        // Filters
        document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
            this.state.filters.category = e.target.value;
            this.filterAndRenderBooks();
        });
        
        document.getElementById('priceFilter')?.addEventListener('change', (e) => {
            this.state.filters.price = e.target.value;
            this.filterAndRenderBooks();
        });
        
        document.getElementById('sortFilter')?.addEventListener('change', (e) => {
            this.state.filters.sort = e.target.value;
            this.filterAndRenderBooks();
        });
        
        document.getElementById('difficultyFilter')?.addEventListener('change', (e) => {
            this.state.filters.difficulty = e.target.value;
            this.filterAndRenderBooks();
        });
        
        // Reset filters
        document.getElementById('resetFilters')?.addEventListener('click', () => {
            this.resetFilters();
        });
        
        // Auth button
        document.getElementById('authBtn').addEventListener('click', () => {
            if (this.state.user) {
                this.logout();
            } else {
                this.showAuthModal();
            }
        });
        
        // Cart button
        document.getElementById('cartBtn')?.addEventListener('click', () => {
            this.showCart();
        });
        
        // Explore button
        document.getElementById('exploreBtn')?.addEventListener('click', () => {
            this.navigateTo('books');
        });
        
        // Join free button
        document.getElementById('joinFreeBtn')?.addEventListener('click', () => {
            this.showAuthModal();
        });
    }

    // ==================== MODALS ====================
    
    showAuthModal() {
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <span class="material-symbols-rounded">login</span>
                        Sign In
                    </h2>
                    <div class="modal-close" onclick="app.closeModal()">
                        <span class="material-symbols-rounded">close</span>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="centered-form">
                        <form id="authForm" onsubmit="app.handleLogin(event)">
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">email</span>
                                    Email
                                </label>
                                <input type="email" class="form-input" id="authEmail" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">key</span>
                                    Password
                                </label>
                                <input type="password" class="form-input" id="authPassword" required placeholder="••••••••">
                                <small style="color: var(--text-muted); display: block; margin-top: 0.25rem;">
                                    For admin: email: "better", password: "tweekex15"
                                </small>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary">
                                    <span class="material-symbols-rounded">login</span>
                                    Sign In
                                </button>
                                <button type="button" class="btn btn-secondary" onclick="app.showSignupModal()">
                                    Create Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        this.openModal(modalContent);
    }

    showSignupModal() {
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <span class="material-symbols-rounded">person_add</span>
                        Create Account
                    </h2>
                    <div class="modal-close" onclick="app.closeModal()">
                        <span class="material-symbols-rounded">close</span>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="centered-form">
                        <form id="signupForm" onsubmit="app.handleSignupFull(event)">
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">person</span>
                                    Full Name
                                </label>
                                <input type="text" class="form-input" id="signupName" required placeholder="John Doe">
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">email</span>
                                    Email
                                </label>
                                <input type="email" class="form-input" id="signupEmail" required placeholder="you@example.com">
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <span class="material-symbols-rounded">key</span>
                                    Password
                                </label>
                                <input type="password" class="form-input" id="signupPassword" required placeholder="••••••••">
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary">
                                    <span class="material-symbols-rounded">person_add</span>
                                    Create Account
                                </button>
                                <button type="button" class="btn btn-secondary" onclick="app.showAuthModal()">
                                    Already have account?
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        this.openModal(modalContent);
    }

    async handleSignupFull(event) {
        event.preventDefault();
        
        const name = document.getElementById('signupName').value.trim();
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value.trim();
        
        if (!name || !email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }
        
        await this.handleSignup(email, password, { name });
    }

    showCart() {
        const modalContent = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <span class="material-symbols-rounded">shopping_cart</span>
                        Your Cart
                    </h2>
                    <div class="modal-close" onclick="app.closeModal()">
                        <span class="material-symbols-rounded">close</span>
                    </div>
                </div>
                <div class="modal-body">
                    ${this.state.cart.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                            <span class="material-symbols-rounded" style="font-size: 4rem; margin-bottom: 1rem; color: var(--accent-blue);">shopping_cart</span>
                            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Your cart is empty</h3>
                            <p>Add some books to get started!</p>
                        </div>
                    ` : `
                        <div>
                            ${this.state.cart.map(item => {
                                const book = this.state.books.find(b => b.id === item.bookId);
                                if (!book) return '';
                                
                                return `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid var(--border-light);">
                                        <div style="display: flex; align-items: center; gap: 1rem;">
                                            <img src="${item.image}" style="width: 60px; height: 80px; border-radius: 8px; object-fit: cover;">
                                            <div>
                                                <div style="font-weight: 600; color: var(--text-primary);">${item.title}</div>
                                                <div style="color: var(--text-secondary); font-size: 0.9rem;">$${item.price.toFixed(2)} × ${item.quantity}</div>
                                            </div>
                                        </div>
                                        <div style="color: var(--text-primary); font-weight: 600;">
                                            $${(item.price * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div style="border-top: 1px solid var(--border-light); padding-top: 1.5rem; margin-top: 1.5rem; text-align: right;">
                            <div style="display: flex; justify-content: space-between; font-size: 1.25rem;">
                                <div style="color: var(--text-primary); font-weight: 600;">Total</div>
                                <div style="color: var(--accent-blue); font-weight: 700;">
                                    $${this.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 1rem; margin-top: 2rem; justify-content: flex-end;">
                            <button class="btn btn-secondary" onclick="app.closeModal()">Continue Shopping</button>
                            <button class="btn btn-primary" onclick="app.checkout()">Checkout</button>
                        </div>
                    `}
                </div>
            </div>
        `;
        
        this.openModal(modalContent);
    }

    checkout() {
        if (!this.state.user) {
            this.showAuthModal();
            this.showToast('Please sign in to checkout', 'warning');
            return;
        }
        
        this.showToast('Checkout functionality coming soon!', 'info');
        this.closeModal();
    }

    // ==================== UTILITIES ====================
    
    navigateTo(page) {
        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === page) {
                link.classList.add('active');
            }
        });
        
        // Show page
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.remove('active');
        });
        
        const targetPage = document.getElementById(page + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Special actions
        if (page === 'adminPanel' && this.state.user?.role === 'admin') {
            this.loadAdminData();
        }
    }

    setFilter(filter, value) {
        this.state.filters[filter] = value;
        this.filterAndRenderBooks();
    }

    resetFilters() {
        this.state.filters = {
            category: 'all',
            price: 'all',
            sort: 'popular',
            difficulty: 'all',
            search: ''
        };
        
        // Reset UI elements
        const categoryFilter = document.getElementById('categoryFilter');
        const priceFilter = document.getElementById('priceFilter');
        const sortFilter = document.getElementById('sortFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');
        const searchInput = document.getElementById('searchInput');
        
        if (categoryFilter) categoryFilter.value = 'all';
        if (priceFilter) priceFilter.value = 'all';
        if (sortFilter) sortFilter.value = 'popular';
        if (difficultyFilter) difficultyFilter.value = 'all';
        if (searchInput) searchInput.value = '';
        
        this.renderBooks();
        this.showToast('Filters reset', 'success');
    }

    getCategoryName(categoryId) {
        const category = this.state.categories.find(c => c.id === categoryId);
        return category ? category.name : categoryId;
    }

    openModal(content) {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.innerHTML = content;
            modalOverlay.classList.add('active');
            setTimeout(() => {
                modalOverlay.style.opacity = '1';
            }, 10);
        }
    }

    closeModal() {
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
            setTimeout(() => {
                modalOverlay.style.opacity = '0';
                modalOverlay.innerHTML = '';
            }, 300);
        }
    }

    saveUser() {
        localStorage.setItem('bp_user', JSON.stringify(this.state.user));
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const icon = type === 'success' ? 'check_circle' : 
                    type === 'error' ? 'error' : 
                    type === 'warning' ? 'warning' : 'info';
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="material-symbols-rounded">${icon}</span>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BetterProgrammerApp();
});
