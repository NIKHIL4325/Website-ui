// --- Global Configuration ---
// This endpoint assumes your Vercel function is deployed under /api/products
// Note: When deployed on Netlify, you might need to ensure CORS is configured on your Vercel backend.
const API_URL = '/api/products'; 
const CART_STORAGE_KEY = 'fashionhub_cart';
let allProducts = [];

// --- Utility Functions (Local Storage for Cart) ---

/**
 * Persists the cart state to the browser's local storage.
 * @param {Array<Object>} cart - The current cart array.
 */
const saveCart = (cart) => {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
        console.error("Could not save cart to local storage:", e);
    }
};

/**
 * Loads the cart state from local storage.
 * @returns {Array<Object>} The loaded cart array or an empty array.
 */
const loadCart = () => {
    try {
        const cartJson = localStorage.getItem(CART_STORAGE_KEY);
        return cartJson ? JSON.parse(cartJson) : [];
    } catch (e) {
        console.error("Could not load cart from local storage:", e);
        return [];
    }
};

/**
 * Updates the cart item count displayed in the navigation.
 */
const updateCartCount = () => {
    const cart = loadCart();
    // Calculate total quantity of items in the cart
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
    }
};

// --- Product Data Fetching ---

/**
 * Fetches product data from the Vercel Serverless Function.
 */
const fetchProducts = async () => {
    // Fallback data in case the API call fails
    const fallbackProducts = [
        { id: 1, name: 'Minimalist T-Shirt', price: 24.99, image: 'https://placehold.co/300x200/4c66ff/ffffff?text=T-Shirt', description: 'Soft organic cotton, perfect for layering.', featured: true },
        { id: 2, name: 'Classic Denim Jacket', price: 79.99, image: 'https://placehold.co/300x200/5c7b94/ffffff?text=Jacket', description: 'A timeless staple for every wardrobe.', featured: true },
        { id: 3, name: 'Leather Sneakers', price: 119.50, image: 'https://placehold.co/300x200/212529/ffffff?text=Sneakers', description: 'Premium leather finish for all-day comfort.', featured: false },
        { id: 4, name: 'Wool Blend Scarf', price: 35.00, image: 'https://placehold.co/300x200/95a5a6/ffffff?text=Scarf', description: 'Keeps you warm and stylish in the cold.', featured: false },
        { id: 5, name: 'Striped Summer Dress', price: 65.00, image: 'https://placehold.co/300x200/ff9900/ffffff?text=Dress', description: 'Lightweight fabric with a flowy silhouette.', featured: false }
    ];

    try {
        // Fetch data from the deployed Vercel backend
        const response = await fetch(API_URL);
        if (!response.ok) {
            console.warn(`API call to ${API_URL} failed (Status: ${response.status}). Using local fallback data.`);
            allProducts = fallbackProducts;
            return;
        }
        allProducts = await response.json();
    } catch (error) {
        console.error("Network or Fetch error. Using local fallback data.", error);
        allProducts = fallbackProducts;
    }
};

// --- Rendering Functions ---

/**
 * Creates the HTML for a single product card.
 */
const renderProductCard = (product) => {
    return `
        <div class="product-card">
            <a href="product-details.html?id=${product.id}">
                <img src="${product.image}" alt="${product.name}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/000000?text=Image+Error';" class="mb-4">
            </a>
            <h3 class="font-semibold">${product.name}</h3>
            <p class="text-lg font-bold">$${product.price.toFixed(2)}</p>
            <button data-product-id="${product.id}" class="add-to-cart-btn">Add to Cart</button>
        </div>
    `;
};

/**
 * Renders products to a specific container and attaches 'Add to Cart' listeners.
 */
const renderProducts = (productsToRender, containerId) => {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = productsToRender.map(renderProductCard).join('');
        
        // Attach event listeners for Add to Cart buttons
        container.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', handleAddToCart);
        });
    }
};

// --- Cart Handlers ---

/**
 * Handles adding a product to the cart.
 */
const handleAddToCart = (event) => {
    const productId = parseInt(event.currentTarget.dataset.productId);
    const product = allProducts.find(p => p.id === productId);

    if (!product) return;

    let cart = loadCart();
    const existingItemIndex = cart.findIndex(item => item.id === productId);

    if (existingItemIndex !== -1) {
        // Increment quantity if product exists
        cart[existingItemIndex].quantity += 1;
    } else {
        // Add new product to cart
        cart.push({ ...product, quantity: 1 });
    }

    saveCart(cart);
    updateCartCount();
    
    showNotification(`${product.name} added to cart!`, 'success'); 
};

/**
 * Handles removing a product from the cart.
 */
const handleRemoveFromCart = (event) => {
    const productId = parseInt(event.currentTarget.dataset.productId);
    let cart = loadCart();
    
    // Filter out the item with the matching ID
    cart = cart.filter(item => item.id !== productId);

    saveCart(cart);
    updateCartCount();
    initCartPage(); // Re-render cart content to reflect changes
    showNotification('Item removed from cart.', 'info');
};

const handleCheckout = () => {
    // In a real application, this would trigger a payment gateway and API call.
    showNotification('Checkout successful! Thank you for your order. We will process your items shortly.', 'success');
    saveCart([]); // Clear cart
    updateCartCount();
    initCartPage(); // Re-render cart (which will now show 'Your cart is empty')
};

// --- Page Initialization Logic ---

const initHomePage = () => {
    // Home page shows the first 3 featured products
    const featuredProducts = allProducts.filter(p => p.featured).slice(0, 3);
    renderProducts(featuredProducts, 'featured-products');
};

const initProductsPage = () => {
    // Products page shows all items
    renderProducts(allProducts, 'product-list');
};

const initProductDetailsPage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
        // Handle case where product is not found
        document.querySelector('section.container').innerHTML = `
            <div class="text-center p-10 bg-white rounded-xl shadow-lg">
                <p class="text-3xl text-red-500 font-bold mb-4">404 - Product Not Found</p>
                <p class="text-gray-600">The item you are looking for does not exist.</p>
                <a href="products.html" class="mt-4 inline-block text-blue-600 hover:underline">Return to Products</a>
            </div>
        `;
        return;
    }
    
    // Populate details from the fetched product
    document.getElementById('product-image').src = product.image;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('product-description').textContent = product.description;
    
    // Attach 'Add to Cart' listener
    const addToCartButton = document.getElementById('add-to-cart');
    if (addToCartButton) {
        addToCartButton.dataset.productId = productId;
        addToCartButton.addEventListener('click', handleAddToCart);
    }
};

const initCartPage = () => {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutButton = document.getElementById('checkout');
    const cart = loadCart();

    if (!cartItemsContainer || !cartTotalElement) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-center text-gray-500 text-lg p-10 bg-white rounded-xl shadow-md">Your cart is empty. Start shopping now!</p>';
        cartTotalElement.textContent = 'Total: $0.00';
        if (checkoutButton) checkoutButton.disabled = true;
        return;
    }
    
    if (checkoutButton) checkoutButton.disabled = false;
    let total = 0;
    
    const cartHtml = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <h3 class="font-bold">${item.name}</h3>
                    <p>Quantity: ${item.quantity}</p>
                    <p class="text-blue-600 font-semibold">Price: $${item.price.toFixed(2)}</p>
                </div>
                <p class="text-xl font-bold mr-4">$${itemTotal.toFixed(2)}</p>
                <button data-product-id="${item.id}" class="remove-from-cart-btn">Remove</button>
            </div>
        `;
    }).join('');

    cartItemsContainer.innerHTML = cartHtml;
    cartTotalElement.textContent = `Total: $${total.toFixed(2)}`;

    // Attach 'Remove' button listeners
    cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', handleRemoveFromCart);
    });
    
    // Attach 'Checkout' button listener only once
    if (checkoutButton && !checkoutButton.hasAttribute('data-listener-attached')) {
        checkoutButton.addEventListener('click', handleCheckout);
        checkoutButton.setAttribute('data-listener-attached', 'true');
    }
};

// --- Custom Notification (Replaces alert()) ---

/**
 * Shows a custom notification message.
 */
function showNotification(message, type = 'info') {
    const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    
    const notification = document.createElement('div');
    // Mobile-friendly: fixed position, slight padding
    notification.className = `fixed bottom-5 right-5 p-4 rounded-xl shadow-xl text-white max-w-xs transition-opacity duration-300 opacity-0 z-50 ${color}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => { notification.classList.remove('opacity-0'); }, 10);

    // Fade out and remove
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// --- Main Application Entry Point ---

const initializeApp = async () => {
    // 1. Fetch product data (independent of auth/persistence)
    await fetchProducts(); 
    
    // 2. Ensure cart count is updated immediately
    updateCartCount();
    
    // 3. Initialize page-specific logic
    const pathname = window.location.pathname;
    
    if (pathname.endsWith('index.html') || pathname === '/') {
        initHomePage();
    } else if (pathname.endsWith('products.html')) {
        initProductsPage();
    } else if (pathname.endsWith('cart.html')) {
        initCartPage();
    } else if (pathname.endsWith('product-details.html')) {
        initProductDetailsPage();
    } 
};


// Start the application when the window is fully loaded
window.addEventListener('load', initializeApp);
