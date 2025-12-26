const token = localStorage.getItem("token");
if (!token) location.href = "/";

function logout() {
  localStorage.removeItem("token");
  location.href = "/";
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
  document.getElementById("tab-" + name).classList.remove("hidden");
}

/* ================= ORDERS ================= */

async function loadOrders() {
  const r = await fetch("/api/admin/orders", {
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = await r.json();

  document.getElementById("ordersTable").innerHTML = list.map(o => `
    <tr>
      <td>${o.productTitle}</td>
      <td>${o.planName}</td>
      <td>${o.finalPrice}$</td>
      <td>${o.status}</td>
      <td>
        ${o.proofImage ? `<a href="${o.proofImage}" target="_blank">صورة</a>` : "-"}
      </td>
      <td>
        ${o.status === "pending" ? `
          <button onclick="approve('${o._id}')">قبول</button>
          <button onclick="reject('${o._id}')">رفض</button>
        ` : "-"}
      </td>
    </tr>
  `).join("");
}

async function approve(id) {
  await fetch(`/api/admin/order/${id}/approve`, { method: "POST" });
  loadOrders();
}

async function reject(id) {
  await fetch(`/api/admin/order/${id}/reject`, { method: "POST" });
  loadOrders();
}

/* ================= PRODUCTS ================= */

async function loadProducts() {
  const r = await fetch("/api/admin/products");
  const list = await r.json();

  document.getElementById("productsList").innerHTML = list.map(p => `
    <div class="box">
      <b>${p.title}</b>
      <button onclick="delProduct('${p._id}')">حذف</button>
    </div>
  `).join("");
}

async function addProduct() {
  await fetch("/api/admin/product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: pTitle.value,
      description: pDesc.value,
      images: [pImage.value],
      plans: []
    })
  });
  loadProducts();
}

async function delProduct(id) {
  await fetch(`/api/admin/product/${id}`, { method: "DELETE" });
  loadProducts();
}

/* ================= COUPONS ================= */

async function loadCoupons() {
  const r = await fetch("/api/admin/coupons");
  const list = await r.json();

  document.getElementById("couponsList").innerHTML = list.map(c => `
    <div class="box">
      ${c.code} — ${c.type} ${c.value}
    </div>
  `).join("");
}

async function addCoupon() {
  await fetch("/api/admin/coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: cCode.value,
      type: cType.value,
      value: Number(cValue.value),
      expiresAt: cExpire.value
    })
  });
  loadCoupons();
}

/* INIT */
loadOrders();
loadProducts();
loadCoupons();
