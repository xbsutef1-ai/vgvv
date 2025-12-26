const productsEl = document.getElementById("products");
const categoriesEl = document.getElementById("categories");
const userBox = document.getElementById("userBox");

let productsCache = [];
let currentCategory = "all";

/* ================= USER ================= */
function getUser(){
  const email = localStorage.getItem("email");
  return email ? { email } : null;
}

function renderUser(){
  const u = getUser();

  if(!u){
    userBox.innerHTML = `
      <button class="login-btn" onclick="fakeLogin()">Login</button>
    `;
    return;
  }

  const letter = u.email[0].toUpperCase();
  userBox.innerHTML = `
    <div class="avatar">${letter}</div>
  `;
}

function fakeLogin(){
  localStorage.setItem("email","user@example.com");
  renderUser();
}

renderUser();

/* ================= CATEGORIES ================= */
async function loadCategories(){
  try{
    const r = await fetch("/api/store/categories");
    const cats = await r.json();

    categoriesEl.innerHTML = `
      <button class="catBtn active" onclick="pickCat('all')">الكل</button>
    ` + cats.map(c=>`
      <button class="catBtn" onclick="pickCat('${c.slug}')">${c.name}</button>
    `).join("");
  }catch{
    categoriesEl.innerHTML = `
      <button class="catBtn active">الكل</button>
    `;
  }
}

window.pickCat = async (slug)=>{
  currentCategory = slug;
  document.querySelectorAll(".catBtn").forEach(b=>b.classList.remove("active"));
  event.target.classList.add("active");
  loadProducts();
};

/* ================= PRODUCTS ================= */
async function loadProducts(){
  productsEl.innerHTML = `<div class="loading">Loading...</div>`;

  const r = await fetch(`/api/store/products?category=${currentCategory}`);
  const list = await r.json();

  productsCache = Array.isArray(list)?list:[];
  renderProducts();
}

function renderProducts(){
  productsEl.innerHTML = productsCache.map(p=>{
    const img = p.images?.[0] || "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb";
    return `
      <article class="card">
        <div class="card-img" style="background-image:url('${img}')"></div>
        <div class="card-body">
          <div class="card-title">${p.title}</div>
          <div class="card-desc">${p.description || ""}</div>
          <button class="buy-btn">عرض المنتج</button>
        </div>
      </article>
    `;
  }).join("");

  animateCards();
}

/* ================= ANIMATION ================= */
function animateCards(){
  const cards = document.querySelectorAll(".card");

  const obs = new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting) e.target.classList.add("show");
    });
  },{threshold:0.1});

  cards.forEach(card=>{
    obs.observe(card);

    card.addEventListener("mousemove",e=>{
      const r = card.getBoundingClientRect();
      card.style.setProperty("--x",`${e.clientX-r.left}px`);
      card.style.setProperty("--y",`${e.clientY-r.top}px`);
    });
  });
}

/* ================= INIT ================= */
loadCategories();
loadProducts();
