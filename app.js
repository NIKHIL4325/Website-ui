// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel, collection, doc, setDoc, deleteDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Configuration ---
const API_URL = '/api/products'; 
let allProducts = [];

// --- Firebase Global State Variables ---
let auth;
let db;
let userId = null;
let isAuthReady = false;
let currentCart = []; // The single source of truth for the cart data

// Initialize Firebase App details
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Cart Functions ---

/**
 * Gets the document reference for the user's cart in Firestore.
 * Collection Path: /artifacts/{appId}/users/{userId}/cart
 */
const getCartDocRef = (uid) => {
    return doc(db, 'artifacts', appId, 'users', uid, 'cart', 'items');
};

/**
 * Attaches a real-time listener to the user's cart in Firestore.
 * This replaces all client-side 'loadCart' logic.
 */
const setupRealtimeCartListener = () => {
    if (!isAuthReady || !userId || !db) {
        console.warn("Cannot set up Firestore listener: Auth not ready or DB not initialized.");
        return;
    }

    const cartDocRef = getCartDocRef(userId);

    // onSnapshot provides real-time updates whenever the cart document changes
    onSnapshot(cartDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            // Firestore stores the cart as a map of product IDs to item objects
            const cartData = docSnapshot.data();
            
            // Convert the map data back into an array structure for easier UI rendering
            currentCart = Object.keys(cartData).map(productId => cartData[productId]);
            
            console.log("Cart updated from Firestore:", currentCart);
        } else {
            currentCart = [];
            console.log("Cart is empty (document does not exist).");
        }
        
        // Always re-render the UI whenever the cart changes
        updateCartCount();
        // Only re-render cart page if we are on the cart page
        if (window.location.pathname.endsWith('cart.html')) {
            initCartPage();
        }
    }, (error) => {
        console.error("Error setting up cart snapshot listener:", error);
        showNotification('Failed to load real-time cart data.', 'error');
    });
};

/**
 * Saves the entire cart structure (or a specific item change) back to Firestore.
 * @param {Array<Object>} cartItems - The new array of cart items.
 */
const saveCartToFirestore = async (cartItems) => {
    if (!isAuthReady || !userId || !db) {
        showNotification('Cannot save cart: User not authenticated.', 'error');
        return;
    }

    const cartDocRef = getCartDocRef(userId);
    const cartData = {};

    if (cartItems.length > 0) {
        // Convert array back into a key-value map for storage consistency
        cartItems.forEach(item => {
            cartData[item.id] = item;
        });
        
        try {
            // Use setDoc to overwrite or create the document
            await setDoc(cartDocRef, cartData);
        } catch (error) {
            console.error("Error writing cart to Firestore:", error);
            showNotification('Failed to save cart. Please try again.', 'error');
        }
    } else {
        // If the cart is empty, delete the document to keep the database clean
        try {
            // Check if the document exists before trying to delete
            const docSnap = await getDoc(cartDocRef);
            if (docSnap.exists()) {
                await deleteDoc(cartDocRef);
                console.log("Empty cart deleted from Firestore.");
            }
        } catch (error) {
            console.error("Error deleting empty cart document:", error);
        }
    }
};

/**
 * Updates the cart item count displayed in the navigation.
 */
const updateCartCount = () => {
    // Current cart is now taken from the global currentCart array
    const totalItems = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    const cartCountElement = document.getElementById('cart-count');
    if (cartCountElement) {
        cartCountElement.textContent = totalItems;
    }
    
    // Update the Account link to show the User ID
    const accountLink = document.querySelector('a[href="account.html"]');
    if (accountLink && userId) {
        accountLink.title = `User ID: ${userId}`;
        accountLink.textContent = `Account (${userId.substring(0, 4)}...)`;
    }
    
    // Show user ID on the Account Page
    if (window.location.pathname.endsWith('account.html')) {
        const userIdDisplay = document.getElementById('user-id-display');
        if (userIdDisplay) {
            userIdDisplay.textContent = userId;
        }
    }
};

// --- Product Data Fetching (Unchanged) ---

const fetchProducts = async () => {
    const fallbackProducts = [
        { id: 1, name: 'Minimalist T-Shirt', price: 24.99, image: 'https://placehold.co/300x200/4c66ff/ffffff?text=T-Shirt', description: 'Soft organic cotton, perfect for layering.', featured: true },
        { id: 2, name: 'Classic Denim Jacket', price: 79.99, image: 'https://placehold.co/300x200/5c7b94/ffffff?text=Jacket', description: 'A timeless staple for every wardrobe.', featured: true },
        { id: 3, name: 'Leather Sneakers', price: 119.50, image: 'https://placehold.co/300x200/212529/ffffff?text=Sneakers', description: 'Premium leather finish for all-day comfort.', featured: false },
        { id: 4, name: 'Wool Blend Scarf', price: 35.00, image: 'https://placehold.co/300x200/95a5a6/ffffff?text=Scarf', description: 'Keeps you warm and stylish in the cold.', featured: false },
        { id: 5, name: 'Striped Summer Dress', price: 65.00, image: 'https://placehold.co/300x200/ff9900/ffffff?text=Dress', description: 'Lightweight fabric with a flowy silhouette.', featured: false }
    ];

    try {
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

// --- Rendering Functions (Unchanged) ---

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

const renderProducts = (productsToRender, containerId) => {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = productsToRender.map(renderProductCard).join('');
        
        container.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', handleAddToCart);
        });
    }
};

// --- Cart Handlers (Updated for Firestore) ---

/**
 * Handles adding a product to the cart by updating the Firestore document.
 */
const handleAddToCart = async (event) => {
    const productId = parseInt(event.currentTarget.dataset.productId);
    const product = allProducts.find(p => p.id === productId);

    if (!product) return;
    if (!isAuthReady) {
        showNotification('Please wait for the user session to load before adding items.', 'info');
        return;
    }

    let updatedCart = [...currentCart];
    const existingItemIndex = updatedCart.findIndex(item => item.id === productId);

    if (existingItemIndex !== -1) {
        // Increment quantity if product exists
        updatedCart[existingItemIndex].quantity += 1;
    } else {
        // Add new product to cart
        updatedCart.push({ 
            id: product.id, 
            name: product.name, 
            price: product.price, 
            image: product.image, 
            quantity: 1 
        });
    }

    await saveCartToFirestore(updatedCart);
    showNotification(`${product.name} added to cart!`, 'success'); 
};

/**
 * Handles removing a product from the cart by updating the Firestore document.
 */
const handleRemoveFromCart = async (event) => {
    const productId = parseInt(event.currentTarget.dataset.productId);
    
    // Filter out the item with the matching ID
    let updatedCart = currentCart.filter(item => item.id !== productId);

    await saveCartToFirestore(updatedCart);
    showNotification('Item removed from cart.', 'info');
};

const handleCheckout = async () => {
    showNotification('Processing checkout...', 'info');

    // In a real application, this would save the order details to a 'orders' collection.
    // For this example, we simply clear the cart.
    await saveCartToFirestore([]); // Clear cart in Firestore

    showNotification('Checkout successful! Cart cleared.', 'success');
};

// --- Page Initialization Logic (Updated) ---

const initHomePage = () => {
    const featuredProducts = allProducts.filter(p => p.featured).slice(0, 3);
    renderProducts(featuredProducts, 'featured-products');
};

const initProductsPage = () => {
    renderProducts(allProducts, 'product-list');
};

const initProductDetailsPage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    const product = allProducts.find(p => p.id === productId);

    if (!product) {
        document.querySelector('section.container').innerHTML = '<p class="text-center text-xl text-red-500">Product Not Found.</p>';
        return;
    }
    
    document.getElementById('product-image').src = product.image;
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-price').textContent = `$${product.price.toFixed(2)}`;
    document.getElementById('product-description').textContent = product.description;
    
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
    
    // Cart data now comes from the global currentCart, updated by onSnapshot
    const cart = currentCart; 

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

    cartItemsContainer.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', handleRemoveFromCart);
    });
    
    if (checkoutButton && !checkoutButton.hasAttribute('data-listener-attached')) {
        checkoutButton.addEventListener('click', handleCheckout);
        checkoutButton.setAttribute('data-listener-attached', 'true');
    }
};

const initAccountPage = () => {
    // We need to slightly update account.html to show the User ID, which is critical for debugging
    const accountContent = document.querySelector('.max-w-md.mx-auto');
    if (accountContent && userId) {
        const userIdHtml = `<div class="mb-6 p-4 bg-gray-100 rounded-lg">
            <h4 class="text-sm font-semibold text-gray-600 mb-1">Your Unique User ID</h4>
            <p id="user-id-display" class="text-xs break-all font-mono text-gray-800">${userId}</p>
            <p class="text-xs text-gray-500 mt-2">Use this ID to find your data in Firestore.</p>
        </div>`;
        accountContent.insertAdjacentHTML('afterbegin', userIdHtml);
    }
}

// --- Custom Notification (Unchanged) ---

function showNotification(message, type = 'info') {
    const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    
    const notification = document.createElement('div');
    notification.className = `fixed bottom-5 right-5 p-4 rounded-xl shadow-xl text-white max-w-xs transition-opacity duration-300 opacity-0 z-50 ${color}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => { notification.classList.remove('opacity-0'); }, 10);

    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// --- Main Application Entry Point ---

const initializeApp = async () => {
    // 1. Initialize Firebase and Auth
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        setLogLevel('Debug'); 

        try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Firebase Auth Error:", error);
            showNotification(`Authentication Failed: ${error.message}`, 'error');
        }
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                isAuthReady = true;
                console.log(`User Authenticated. UID: ${userId}. Firebase initialized.`);
                
                // CRITICAL: Setup real-time cart listener immediately after auth
                setupRealtimeCartListener();

                // Fetch products (non-real-time data)
                await fetchProducts(); 
                
                // Initialize UI elements (Account page relies on userId)
                initPageLogic(); 

            } else {
                userId = crypto.randomUUID(); 
                isAuthReady = false;
                console.warn("User not authenticated. Using random ID:", userId);
                
                await fetchProducts(); 
                initPageLogic();
            }
        });
    } else {
        console.warn("Firebase config not found. Running in local mode.");
        await fetchProducts();
        initPageLogic();
    }
};

const initPageLogic = () => {
    const pathname = window.location.pathname;
    
    if (pathname.endsWith('index.html') || pathname === '/') {
        initHomePage();
    } else if (pathname.endsWith('products.html')) {
        initProductsPage();
    } else if (pathname.endsWith('cart.html')) {
        initCartPage();
    } else if (pathname.endsWith('product-details.html')) {
        initProductDetailsPage();
    } else if (pathname.endsWith('account.html')) {
        initAccountPage();
    }
};

window.addEventListener('load', initializeApp);
