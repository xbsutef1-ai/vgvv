const API = "/api/admin";
const token = localStorage.getItem("adminToken");

if(!token){
  const t = prompt("Admin Token:");
  if(!t) location.href="/";
  localStorage.setItem("adminToken", t);
}

function logout(){
  localStorage.removeItem("adminToken");
  location.reload();
}

function headers(){
  return { "Authorization":"Bearer "+localStorage.getItem("adminToken"),
           "Content-Type":"application/json" };
}

/* ===== Tabs ===== */
function showTab(name){
  document.querySelectorAll(".adminTab").forEach(t=>t.classList.add("hidden"));
  document.getElementById("tab-"+name).classList.remove("hidden");
  document.querySelectorAll(".adminBtn").forEach(b=>b.classList.remove("active"));
  event.target.classList.add("active");
}
showTab("overview");

/* ===== Overview ===== */
fetch(API+"/overview",{ headers:headers() })
.then(r=>r.json())
.then(d=>{
  stTotal.textContent=d.total;
  stApproved.textContent=d.approved;
  stPending.textContent=d.pending;
  stRejected.textContent=d.rejected;
});

/* ===== Products ===== */
function loadProducts(){
  fetch(API+"/products",{ headers:headers() })
  .then(r=>r.json())
  .then(list=>{
    productList.innerHTML = list.map(p=>`
      <div class="row">
        <b>${p.title}</b>
        <button onclick="deleteProduct('${p._id}')">Delete</button>
      </div>
    `).join("");
  });
}
loadProducts();

function addProduct(){
  fetch(API+"/products",{
    method:"POST",
    headers:headers(),
    body:JSON.stringify({
      title:pTitle.value,
      description:pDesc.value,
      images:[pImage.value]
    })
  }).then(()=>loadProducts());
}

function deleteProduct(id){
  fetch(API+"/products/"+id,{ method:"DELETE", headers:headers() })
  .then(()=>loadProducts());
}

/* ===== Orders ===== */
function loadOrders(){
  fetch(API+"/orders",{ headers:headers() })
  .then(r=>r.json())
  .then(list=>{
    orderList.innerHTML = list.map(o=>`
      <div class="row">
        ${o.product?.title} - ${o.status}
        <button onclick="approve('${o._id}')">Approve</button>
        <button onclick="reject('${o._id}')">Reject</button>
      </div>
    `).join("");
  });
}
loadOrders();

function approve(id){
  fetch(API+"/orders/"+id+"/approve",{ method:"POST", headers:headers() })
  .then(()=>loadOrders());
}
function reject(id){
  fetch(API+"/orders/"+id+"/reject",{ method:"POST", headers:headers() })
  .then(()=>loadOrders());
}

/* ===== Coupons ===== */
function loadCoupons(){
  fetch(API+"/coupons",{ headers:headers() })
  .then(r=>r.json())
  .then(list=>{
    couponList.innerHTML = list.map(c=>`
      <div class="row">
        ${c.code} (${c.type} ${c.value})
      </div>
    `).join("");
  });
}
loadCoupons();

function addCoupon(){
  fetch(API+"/coupons",{
    method:"POST",
    headers:headers(),
    body:JSON.stringify({
      code:cCode.value,
      type:cType.value,
      value:cValue.value,
      expiresAt:cExpire.value
    })
  }).then(()=>loadCoupons());
}
