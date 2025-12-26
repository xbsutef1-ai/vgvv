const id = new URLSearchParams(location.search).get("id");

let product;
let selectedPlan;

fetch(`/api/store/product/${id}`)
  .then(r => r.json())
  .then(p => {
    product = p;
    document.getElementById("title").innerText = p.title;
    document.getElementById("desc").innerText = p.description;

    document.getElementById("images").innerHTML =
      p.images.map(i => `<img src="${i}">`).join("");

    const sel = document.getElementById("planSelect");
    sel.innerHTML = p.plans.map(pl =>
      `<option value="${pl.name}" data-price="${pl.price}">
        ${pl.name} - ${pl.price}$
      </option>`
    ).join("");

    sel.onchange = () => {
      selectedPlan = sel.value;
      document.getElementById("price").innerText =
        sel.selectedOptions[0].dataset.price + "$";
    };

    sel.onchange();
  });

function buy() {
  fetch("/api/store/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product._id,
      planName: selectedPlan
    })
  }).then(r => r.json())
    .then(d => alert("تم إنشاء الطلب: " + d.orderId));
}
