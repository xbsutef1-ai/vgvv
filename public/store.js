const productsBox = document.getElementById("products");

async function loadProducts() {
  try {
    const res = await fetch("/api/store/products");
    const products = await res.json();

    if (!products.length) {
      productsBox.innerHTML = "<p>لا توجد منتجات حالياً</p>";
      return;
    }

    productsBox.innerHTML = products.map(p => `
      <div class="product-card" onclick="openProduct('${p._id}')">
        <img src="${p.images[0]}" alt="${p.title}">
        <h3>${p.title}</h3>
      </div>
    `).join("");

  } catch (err) {
    productsBox.innerHTML = "<p>خطأ في تحميل المنتجات</p>";
    console.error(err);
  }
}

function openProduct(id) {
  window.location.href = `/product.html?id=${id}`;
}

loadProducts();
