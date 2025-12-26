const page = document.body.dataset.page;

/* ========= STORE ========= */
async function loadStore() {
  const res = await fetch("/api/store/products");
  const products = await res.json();

  const box = document.getElementById("products");
  box.innerHTML = products.map(p => `
    <div class="card" onclick="location.href='/product.html?id=${p._id}'">
      <img src="${p.images?.[0] || ''}">
      <h3>${p.title}</h3>
    </div>
  `).join("");
}

/* ========= PRODUCT ========= */
async function loadProduct() {
  const id = new URLSearchParams(location.search).get("id");
  const res = await fetch(`/api/store/product/${id}`);
  const p = await res.json();

  document.getElementById("productTitle").textContent = p.title;
  document.getElementById("productDesc").textContent = p.description;

  document.getElementById("productImages").innerHTML =
    p.images.map(i => `<img src="${i}">`).join("");

  const sel = document.getElementById("planSelect");
  sel.innerHTML = p.plans.map(pl =>
    `<option value="${pl.name}">${pl.name} - ${pl.price}$</option>`
  ).join("");

  document.getElementById("buyBtn").onclick = async () => {
    const plan = sel.value;
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id, plan })
    });
    alert("تم إنشاء الطلب");
    location.href = "/account.html";
  };
}

/* ========= ACCOUNT ========= */
async function loadAccount() {
  const res = await fetch("/api/orders/my");
  const orders = await res.json();

  document.getElementById("orders").innerHTML = orders.map(o => `
    <div class="box">
      <b>${o.productTitle}</b>
      <div>الحالة: ${o.status}</div>
      ${o.key ? `<div>🔑 ${o.key}</div>` : ""}
    </div>
  `).join("");
}

/* ========= ADMIN ========= */
async function loadAdmin() {
  const res = await fetch("/api/admin/orders");
  const orders = await res.json();

  document.getElementById("adminOrders").innerHTML = orders.map(o => `
    <div class="box">
      <b>${o.userEmail}</b>
      <div>${o.productTitle}</div>
      <button onclick="approve('${o._id}')">قبول</button>
      <button onclick="reject('${o._id}')">رفض</button>
    </div>
  `).join("");
}

async function approve(id){
  await fetch(`/api/admin/orders/${id}/approve`,{method:"POST"});
  location.reload();
}
async function reject(id){
  await fetch(`/api/admin/orders/${id}/reject`,{method:"POST"});
  location.reload();
}

/* ========= INIT ========= */
if (page === "store") loadStore();
if (page === "product") loadProduct();
if (page === "account") loadAccount();
if (page === "admin") loadAdmin();
