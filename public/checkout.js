const qs = new URLSearchParams(location.search);
const order = qs.get("order");

const el = (id)=>document.getElementById(id);

function setStatus(s){
  el("orderStatus").textContent = s || "unknown";
  el("statusHint").textContent =
    s === "approved" ? "✅ تم قبول الطلب" :
    s === "rejected" ? "❌ تم رفض الطلب" :
    s === "pending_review" ? "⏳ باننتظار مراجعة الإثبات" :
    s === "pending" ? "⏳ تم إنشاء الطلب - ارفع الإثبات" :
    "⏳ جاري...";
}

async function loadOrder(){
  // إذا ما عندك endpoint لجلب الطلب، ما نكسر الصفحة.
  // تقدر تضيفه لاحقًا. الآن نخليها معلومات بسيطة.
  el("orderId").textContent = order || "N/A";
  setStatus("pending");
}

el("proofFile").addEventListener("change", ()=>{
  const f = el("proofFile").files?.[0];
  el("fileName").textContent = f ? f.name : "لا يوجد ملف";
});

el("proofForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if (!order) return alert("Order ID غير موجود");

  const file = el("proofFile").files?.[0];
  if (!file) return alert("اختر صورة");

  el("sendBtn").disabled = true;
  el("msg").textContent = "جارٍ الرفع...";

  const fd = new FormData();
  fd.append("proof", file);

  const res = await fetch(`/api/orders/${encodeURIComponent(order)}/proof`, {
    method: "POST",
    body: fd
  });

  const data = await res.json().catch(()=> ({}));

  if (!res.ok){
    el("msg").textContent = data?.error || "فشل رفع الإثبات";
    el("sendBtn").disabled = false;
    return;
  }

  el("msg").textContent = "✅ تم إرسال الإثبات. راقب الإيميل/الديسكورد للتحديثات.";
  setStatus("pending_review");
});

loadOrder();
