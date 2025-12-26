const API = "/api";

/* ===== User ===== */
function getUser(){
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}
function setUser(u){
  localStorage.setItem("user", JSON.stringify(u));
}
function logout(){
  localStorage.removeItem("user");
  location.reload();
}

/* ===== Header User Box ===== */
function renderUser(){
  const box = document.getElementById("userBox");
  if(!box) return;

  const u = getUser();
  if(!u){
    box.innerHTML = `<button class="btn ghost" onclick="login()">Login</button>`;
  }else{
    box.innerHTML = `
      <div class="avatar" onclick="location.href='/account.html'">
        ${u.name[0].toUpperCase()}
      </div>
    `;
  }
}
renderUser();

/* ===== Login (مؤقت بسيط) ===== */
function login(){
  const email = prompt("Email");
  const password = prompt("Password");

  fetch(API + "/auth/login",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ email,password })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);
    setUser(d);
    location.reload();
  });
}

/* ===== Products ===== */
async function loadProducts(){
  const el = document.getElementById("products");
  if(!el) return;

  const r = await fetch(API + "/store/products");
  const list = await r.json();

  el.innerHTML = list.map(p=>`
    <article class="card" onclick="location.href='/product.html?id=${p._id}'">
      <img src="${p.images[0]}">
      <div class="cardTitle">${p.title}</div>
    </article>
  `).join("");
}
loadProducts();

/* ===== Product Page ===== */
async function loadProductPage(){
  const id = new URLSearchParams(location.search).get("id");
  if(!id) return;

  const r = await fetch(API + "/store/product/" + id);
  const p = await r.json();

  document.getElementById("pTitle").textContent = p.title;
  document.getElementById("pDesc").textContent = p.description;
  document.getElementById("mainImg").src = p.images[0];

  document.getElementById("thumbs").innerHTML =
    p.images.map(i=>`<img src="${i}" onclick="mainImg.src='${i}'">`).join("");

  const sel = document.getElementById("planSelect");
  sel.innerHTML = p.plans.map(pl=>`
    <option value="${pl.price}">${pl.name} - ${pl.price}$</option>
  `).join("");

  document.getElementById("pPrice").textContent = sel.value;
  sel.onchange = ()=> document.getElementById("pPrice").textContent = sel.value;

  window.goCheckout = ()=>{
    sessionStorage.setItem("checkout", JSON.stringify({
      product:p._id,
      plan:sel.options[sel.selectedIndex].text,
      price:sel.value
    }));
    location.href="/checkout.html";
  };
}
loadProductPage();

/* ===== Checkout ===== */
function createOrder(){
  const u = getUser();
  if(!u) return alert("سجل دخول");

  const c = JSON.parse(sessionStorage.getItem("checkout"));
  fetch(API + "/checkout",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+u.token
    },
    body:JSON.stringify(c)
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);
    location.href="/account.html";
  });
}

/* ===== Account ===== */
async function loadAccount(){
  const u = getUser();
  if(!u) return location.href="/";

  document.getElementById("accName").textContent = u.name;
  document.getElementById("accEmail").textContent = u.email;

  const r = await fetch(API + "/orders",{
    headers:{ Authorization:"Bearer "+u.token }
  });
  const list = await r.json();

  document.getElementById("orders").innerHTML = list.map(o=>`
    <div class="order">
      <div>${o.product.title}</div>
      <div>${o.planName}</div>
      <div>${o.status}</div>
      <div>${o.deliveredKey || ""}</div>
    </div>
  `).join("");
}
loadAccount();
