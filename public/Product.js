const qs = new URLSearchParams(location.search);
const productId = qs.get("id");

const el = (id) => document.getElementById(id);

let product = null;
let selectedPlan = null;
let couponPreview = null;

function money(n){
  const x = Number(n || 0);
  return `$${(Math.round(x * 100) / 100).toFixed(2)}`;
}

function safeArr(x){ return Array.isArray(x) ? x : []; }

function setMainImage(url){
  const img = el("mainImg");
  img.src = url || "/no-image.png";
}

function renderGallery(images){
  const imgs = safeArr(images);
  setMainImage(imgs[0] || "/no-image.png");

  const thumbs = el("thumbs");
  thumbs.innerHTML = imgs.map((src, i)=>`
    <button class="thumb ${i===0?'active':''}" data-src="${src}">
      <img src="${src}" alt="">
    </button>
  `).join("");

  thumbs.querySelectorAll(".thumb").forEach(btn=>{
    btn.onclick = ()=>{
      thumbs.querySelectorAll(".thumb").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      setMainImage(btn.dataset.src);
    };
  });
}

function planStock(plan){
  const keys = safeArr(plan?.keys);
  if (keys.length) return keys.length;
  const s = Number(plan?.stock || 0);
  return isFinite(s) ? s : 0;
}

function renderPlans(plans){
  const list = el("planList");
  const ps = safeArr(plans);

  if (!ps.length){
    list.innerHTML = `<div class="small">لا توجد فترات لهذا المنتج (أضف Plans من الداشبورد)</div>`;
    selectedPlan = null;
    updateTotals();
    return;
  }

  // Default select first available (or first)
  const first = ps.find(p => planStock(p) > 0) || ps[0];
  selectedPlan = { name: first.name, price: Number(first.price || 0), stock: planStock(first) };

  list.innerHTML = ps.map(p=>{
    const stock = planStock(p);
    const price = Number(p?.price || 0);
    const disabled = stock <= 0 ? "disabled" : "";
    const active = (p?.name === selectedPlan.name) ? "active" : "";
    return `
      <button class="planChip ${active}" ${disabled}
              data-name="${String(p?.name||'Plan')}"
              data-price="${price}"
              data-stock="${stock}">
        <div class="pcTop">
          <b>${String(p?.name||'Plan')}</b>
          <span class="pcPrice">${money(price)}</span>
        </div>
        <div class="pcBottom">
          <span class="pcStock ${stock<=0?'out':''}">المتوفر: ${stock}</span>
          <span class="pcTag">${stock<=0 ? "Out of stock" : "Ready"}</span>
        </div>
      </button>
    `;
  }).join("");

  list.querySelectorAll(".planChip").forEach(btn=>{
    btn.onclick = ()=>{
      if (btn.hasAttribute("disabled")) return;
      list.querySelectorAll(".planChip").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");

      selectedPlan = {
        name: btn.dataset.name,
        price: Number(btn.dataset.price || 0),
        stock: Number(btn.dataset.stock || 0)
      };
      couponPreview = null;
      el("couponHint").textContent = "";
      updateTotals();
    };
  });

  updateTotals();
}

async function fetchProduct(){
  if (!productId){
    el("pTitle").textContent = "Product ID غير موجود";
    el("pBadge").textContent = "Error";
    return;
  }

  const res = await fetch(`/api/store/product/${encodeURIComponent(productId)}`);
  const data = await res.json();

  product = data;
  el("pTitle").textContent = product?.title || "Product";
  el("pDesc").textContent = product?.description || "";
  el("pBadge").textContent = product?.category ? product.category : "GLOM";
  renderGallery(product?.images || []);
  renderPlans(product?.plans || []);
}

function updateTotals(){
  const base = Number(selectedPlan?.price || 0);
  let discount = 0;

  if (couponPreview && couponPreview.valid){
    if (couponPreview.type === "percent"){
      discount = base * (Number(couponPreview.value||0) / 100);
    } else if (couponPreview.type === "amount"){
      discount = Math.min(base, Number(couponPreview.value||0));
    }
  }

  const final = Math.max(0, base - discount);

  el("basePrice").textContent = money(base);
  el("discountPrice").textContent = money(discount);
  el("finalPrice").textContent = money(final);
}

async function previewCoupon(code){
  // optional endpoint if you have: GET /api/store/coupon/:code
  // إذا ما عندك، نخليها “بدون معاينة” وما نكسر شي
  if (!code) {
    couponPreview = null;
    el("couponHint").textContent = "";
    updateTotals();
    return;
  }

  try{
    const r = await fetch(`/api/store/coupon/${encodeURIComponent(code.toUpperCase())}`);
    if (!r.ok){
      couponPreview = { valid:false };
      el("couponHint").textContent = "الكوبون غير صالح";
      updateTotals();
      return;
    }
    const c = await r.json();
    couponPreview = { valid:true, type:c.type, value:c.value };
    el("couponHint").textContent = `تم تطبيق خصم (${c.type === 'percent' ? c.value+'%' : money(c.value)})`;
    updateTotals();
  }catch{
    // no endpoint / error
    couponPreview = null;
    el("couponHint").textContent = "";
    updateTotals();
  }
}

el("coupon").addEventListener("input", ()=>{
  const code = el("coupon").value.trim();
  // debounce بسيط
  clearTimeout(window.__cpT);
  window.__cpT = setTimeout(()=>previewCoupon(code), 350);
});

el("buyBtn").onclick = async ()=>{
  if (!product) return alert("المنتج غير جاهز");
  if (!selectedPlan) return alert("اختر فترة");
  if (Number(selectedPlan.stock || 0) <= 0) return alert("Out of stock");

  const couponCode = el("coupon").value.trim() || null;

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      productId: product._id,
      planName: selectedPlan.name,
      couponCode
    })
  });

  const data = await res.json();
  if (!res.ok){
    alert(data?.error || "فشل إنشاء الطلب");
    return;
  }

  location.href = `/checkout.html?order=${encodeURIComponent(data.orderId)}`;
};

fetchProduct();
