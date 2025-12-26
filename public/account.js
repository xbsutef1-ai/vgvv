async function login() {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();
  if (data.token) {
    localStorage.setItem("token", data.token);
    location.href = "/admin.html";
  } else {
    alert("خطأ في الدخول");
  }
}

async function register() {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name.value,
      email: email.value,
      password: password.value
    })
  });

  const data = await res.json();
  alert(data.success ? "تم إنشاء الحساب" : "خطأ");
}

function toggle() {
  document.getElementById("register").classList.toggle("hidden");
}
