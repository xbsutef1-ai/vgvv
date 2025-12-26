const productsEl = document.getElementById("products");
const modal = document.getElementById("productModal");

let products = [];
let selectedProduct = null;
let selectedPlan = null;

/* ================= LOAD PRODUCTS ================= */
async function loadProducts() {
  const res = await fetch("/api/store/products");
  products = await res.json();

  productsEl.innerHTML = products.map(p => `
    <div class="product-card" onclick="openProduct('${p._id}')">
      <img src="${p.images?.[0] || 'https://picsum.photos/400'}">
      <h3>${p.title}</h3>
    </div>
  `).join("");

  animateCards();
}

/* ================= PRODUCT PAGE ================= */
function openProduct(id) {
  selectedProduct = products.find(p => p._id === id);
  if (!selectedProduct) return;

  document.getElementById("pTitle").innerText = selectedProduct.title;
  document.getElementById("pDesc").innerText = selectedProduct.description;

  document.getElementById("productImages").innerHTML =
    selectedProduct.images.map(i => `<img src="${i}">`).join("");

  document.getElementById("planSelect").innerHTML =
    selectedProduct.plans.map(pl =>
      `<option value="${pl.name}">${pl.name} - ${pl.price}$</option>`
    ).join("");

  modal.classList.remove("hidden");
}

function closeProduct() {
  modal.classList.add("hidden");
}

/* ================= CHECKOUT ================= */
async function checkout() {
  const planName = document.getElementById("planSelect").value;

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: selectedProduct._id,
      planName
    })
  });

  const data = await res.json();
  alert("تم إنشاء الطلب: " + data.orderId);
}

/* ================= ANIMATIONS ================= */
function animateCards() {
  const cards = document.querySelectorAll(".product-card");
  cards.forEach((c, i) => {
    c.style.animationDelay = `${i * 0.1}s`;
    c.classList.add("show");
  });
}

/* ================= CURSOR GLOW ================= */
const cursor = document.querySelector(".cursor-glow");
document.addEventListener("mousemove", e => {
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";
});

/* INIT */
loadProducts();
