/* ================= AUTH UI ================= */
function authPopup(){
  const email = prompt("Email");
  const password = prompt("Password");
  if(!email||!password) return;

  fetch("/api/auth/login",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ email,password })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error==="NOT_VERIFIED"){
      verifyPopup(email);
      return;
    }
    if(d.error) return alert(d.error);
    localStorage.setItem("user",JSON.stringify(d));
    location.reload();
  });
}

function registerPopup(){
  const name = prompt("Name");
  const email = prompt("Email");
  const password = prompt("Password");
  if(!name||!email||!password) return;

  fetch("/api/auth/register",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ name,email,password })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);
    verifyPopup(email);
  });
}

function verifyPopup(email){
  const code = prompt("Enter verification code");
  if(!code) return;

  fetch("/api/auth/verify",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify({ email,code })
  })
  .then(r=>r.json())
  .then(d=>{
    if(d.error) return alert(d.error);
    alert("Verified! Login now.");
  });
}
