const token = localStorage.getItem("token");
if (!token) location.href = "/account.html";

async function load() {
  const res = await fetch("/api/admin/overview");
  const s = await res.json();

  sTotal.innerText = "كل الطلبات: " + s.total;
  sPending.innerText = "بانتظار: " + s.pending;
  sApproved.innerText = "مقبولة: " + s.approved;
  sRejected.innerText = "مرفوضة: " + s.rejected;

  const o = await fetch("/api/admin/orders").then(r => r.json());
  orders.innerHTML = o.map(x => `
    <div class="order">
      <b>${x._id}</b> – ${x.status}
      <button onclick="approve('${x._id}')">قبول</button>
      <button onclick="reject('${x._id}')">رفض</button>
    </div>
  `).join("");
}

async function approve(id) {
  await fetch(`/api/admin/orders/${id}/approve`, { method: "POST" });
  load();
}

async function reject(id) {
  await fetch(`/api/admin/orders/${id}/reject`, { method: "POST" });
  load();
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/";
}

load();
