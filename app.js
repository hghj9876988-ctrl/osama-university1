const $ = id => document.getElementById(id);
const DAYS = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

let lectures = load("ou_lectures", []);
let profile = load("ou_profile", {name:"", number:""});
let activeQuiz = null;
let currentUser = null;
let isAdmin = false;
let summaries = [];
let summariesUnsubscribe = null;

function dateDay(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return d.getDay();}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function sortLectures(a){return [...a].sort((x,y)=>x.time.localeCompare(y.time));}
function lectureCard(l, editable=false){
  return `<article class="lecture card"><div class="time">${escapeHtml(l.time)}</div><div class="lecture-info"><b>${escapeHtml(l.subject)}</b><small>${escapeHtml(l.doctor)} · ${escapeHtml(l.room||"القاعة غير محددة")} · ${DAYS[l.day]}</small></div>${editable?`<div class="lecture-actions"><button class="mini" data-edit="${escapeHtml(l.id)}">✎</button><button class="mini delete" data-delete="${escapeHtml(l.id)}">حذف</button></div>`:""}</article>`;
}
function render(){
  const today=sortLectures(lectures.filter(x=>x.day===dateDay()));
  const tomorrow=sortLectures(lectures.filter(x=>x.day===dateDay(1)));
  $("todayCount").textContent=today.length;
  $("tomorrowCount").textContent=tomorrow.length;
  $("todayList").innerHTML=today.length?today.map(x=>lectureCard(x)).join():empty("لا توجد محاضرات مسجلة لهذا اليوم.");
  $("tomorrowList").innerHTML=tomorrow.length?tomorrow.map(x=>lectureCard(x)).join():empty("لا توجد محاضرات مسجلة للغد.");
  renderSchedule();
  renderPdfs();
  $("welcomeTitle").textContent=profile.name?`مرحباً ${profile.name}`:"نظّم دراستك بذكاء";
}
function empty(msg){return `<div class="card" style="padding:15px;color:#718096">${escapeHtml(msg)}</div>`;}
function renderSchedule(){
  const filter=$("dayFilter").value;
  const list=sortLectures(lectures.filter(x=>filter==="all"||x.day===Number(filter)));
  $("scheduleList").innerHTML=list.length?list.map(x=>lectureCard(x,isAdmin)).join():empty("لا توجد محاضرات مسجلة.");
  $("addLectureBtn").hidden=!isAdmin;
}
function renderPdfs(){
  $("pdfCount").textContent=summaries.length;
  if(!currentUser){
    $("pdfList").innerHTML=empty("سجّل الدخول بحساب Google لمشاهدة الملخصات.");
    $("libraryNotice").textContent="يجب تسجيل الدخول لعرض الملفات المشتركة.";
    return;
  }
  $("libraryNotice").textContent=isAdmin?"يمكنك إضافة ملفات PDF وإدارتها.":"يمكنك مشاهدة الملخصات وتنزيلها.";
  $("uploadLabel").hidden=!isAdmin;
  $("pdfList").innerHTML=summaries.length?summaries.map(p=>`
    <div class="pdf-item card">
      <span class="pdf-symbol">📕</span>
      <div><b>${escapeHtml(p.name||"ملف PDF")}</b><small>${escapeHtml(p.size||"")}</small></div>
      <button class="mini" data-openpdf="${escapeHtml(p.id)}">فتح</button>
      ${isAdmin?`<button class="mini delete" data-delpdf="${escapeHtml(p.id)}">حذف</button>`:""}
    </div>`).join(""):empty("لا توجد ملخصات مضافة حتى الآن.");
}
function showPage(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.page===name));
}
document.querySelectorAll(".tab").forEach(t=>t.addEventListener("click",()=>showPage(t.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.go)));
$("dayFilter").addEventListener("change",renderSchedule);

$("addLectureBtn").addEventListener("click",()=>{
  if(!isAdmin){alert("هذه الخاصية للمشرف فقط.");return;}
  $("lectureForm").reset();$("lectureId").value="";$("dialogTitle").textContent="إضافة محاضرة";$("lectureDialog").showModal();
});
$("lectureForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(!isAdmin){alert("غير مصرح لك بإدارة الجدول.");return;}
  const id=$("lectureId").value||String(Date.now());
  const item={id,subject:$("subject").value.trim(),doctor:$("doctor").value.trim(),day:Number($("lectureDay").value),time:$("lectureTime").value,room:$("room").value.trim()};
  const idx=lectures.findIndex(x=>x.id===id);if(idx>=0)lectures[idx]=item;else lectures.push(item);
  save("ou_lectures",lectures);$("lectureDialog").close();render();
});
$("scheduleList").addEventListener("click",e=>{
  const edit=e.target.dataset.edit, del=e.target.dataset.delete;
  if(!isAdmin)return;
  if(edit){const l=lectures.find(x=>x.id===edit);if(!l)return;$("lectureId").value=l.id;$("subject").value=l.subject;$("doctor").value=l.doctor;$("lectureDay").value=l.day;$("lectureTime").value=l.time;$("room").value=l.room;$("dialogTitle").textContent="تعديل المحاضرة";$("lectureDialog").showModal();}
  if(del&&confirm("هل تريد حذف هذه المحاضرة؟")){lectures=lectures.filter(x=>x.id!==del);save("ou_lectures",lectures);render();}
});

async function uploadSummary(file){
  if(!isAdmin){alert("إضافة الملخصات متاحة للمشرف فقط.");return;}
  if(!file)return;
  if(file.type!=="application/pdf"){alert("يرجى اختيار ملف PDF فقط.");return;}
  if(file.size>15*1024*1024){alert("حجم الملف أكبر من 15 ميجابايت.");return;}
  const safeName=file.name.replace(/[^\w.\-\u0600-\u06FF]/g,"_");
  const storagePath=`summaries/${currentUser.uid}/${Date.now()}_${safeName}`;
  const ref=window.firebaseStorage.ref().child(storagePath);
  $("libraryNotice").textContent="جارٍ رفع الملف، يرجى الانتظار...";
  try{
    await ref.put(file,{contentType:"application/pdf"});
    await window.firebaseDb.collection("summaries").add({
      name:file.name,
      size:(file.size/1024/1024).toFixed(2)+" MB",
      storagePath,
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:currentUser.uid
    });
    $("libraryNotice").textContent="تم رفع الملف بنجاح.";
  }catch(error){
    console.error(error);
    $("libraryNotice").textContent="تعذر رفع الملف. تحقق من قواعد Firebase والاتصال بالإنترنت.";
    alert("فشل رفع الملف: "+(error.message||error));
  }finally{
    $("pdfInput").value="";
  }
}
$("pdfInput").addEventListener("change",e=>uploadSummary(e.target.files[0]));

$("pdfList").addEventListener("click",async e=>{
  const open=e.target.dataset.openpdf,del=e.target.dataset.delpdf;
  if(open){
    const p=summaries.find(x=>x.id===open);if(!p)return;
    try{
      const url=await window.firebaseStorage.ref().child(p.storagePath).getDownloadURL();
      $("pdfMessage").textContent=p.name;
      $("pdfOpen").href=url;
      $("pdfOpen").setAttribute("download",p.name||"summary.pdf");
      $("pdfDialog").showModal();
    }catch(error){console.error(error);alert("تعذر فتح الملف. قد يكون الملف غير موجود أو لا تسمح قواعد Storage بقراءته.");}
  }
  if(del){
    if(!isAdmin){alert("الحذف للمشرف فقط.");return;}
    const p=summaries.find(x=>x.id===del);if(!p)return;
    if(!confirm("هل تريد حذف هذا الملخص لجميع الطلاب؟"))return;
    try{
      await window.firebaseStorage.ref().child(p.storagePath).delete();
      await window.firebaseDb.collection("summaries").doc(p.id).delete();
    }catch(error){console.error(error);alert("تعذر حذف الملف: "+(error.message||error));}
  }
});
$("closePdf").addEventListener("click",()=>$("pdfDialog").close());

$("saveProfile").addEventListener("click",()=>{
  profile={name:$("studentName").value.trim(),number:$("studentNumber").value.trim()};
  save("ou_profile",profile);render();alert("تم حفظ بياناتك على هذا الجهاز.");
});
$("studentName").value=profile.name||"";
$("studentNumber").value=profile.number||"";

const quizzes={
 cpp:[
  {q:"أي كلمة تُستخدم لطباعة نص في C++؟",a:["cin","cout","print","input"],c:1},
  {q:"ما نوع البيانات المناسب لتخزين عدد صحيح؟",a:["int","string","char","bool"],c:0},
  {q:"ما ناتج التعبير 5 + 3؟",a:["2","8","15","53"],c:1},
  {q:"أي رمز يُستخدم لإنهاء التعليمة في C++؟",a:[":",";",".",","],c:1},
  {q:"أي مكتبة نستخدم غالباً مع cout و cin؟",a:["<math.h>","<iostream>","<string.h>","<time.h>"],c:1}
 ],
 python:[
  {q:"أي دالة تُستخدم لعرض النص على الشاشة؟",a:["echo()","print()","writeLine()","show()"],c:1},
  {q:"كيف نكتب تعليقاً من سطر واحد في Python؟",a:["//","#","<!--","**"],c:1},
  {q:"ما ناتج 4 ** 2؟",a:["6","8","16","42"],c:2},
  {q:"أي نوع بيانات يمثل قيمة صحيحة أو خاطئة؟",a:["str","int","bool","list"],c:2},
  {q:"أي كلمة تُستخدم لتعريف دالة؟",a:["function","def","fun","method"],c:1}
 ]
};
function startQuiz(type){activeQuiz={type,index:0,score:0};renderQuestion();}
function renderQuestion(){
  const qz=quizzes[activeQuiz.type],q=qz[activeQuiz.index];
  if(!q){$("quizArea").innerHTML=`<div class="result card"><h3>انتهى الاختبار 🎉</h3><b>${activeQuiz.score} / ${qz.length}</b><p>إجابتك الصحيحة</p><button class="primary" id="retryQuiz">إعادة الاختبار</button></div>`;$("retryQuiz").onclick=()=>startQuiz(activeQuiz.type);return;}
  $("quizArea").innerHTML=`<div class="question card"><small class="muted">السؤال ${activeQuiz.index+1} من ${qz.length}</small><h3>${q.q}</h3>${q.a.map((a,i)=>`<button class="answer" data-answer="${i}">${["أ","ب","ج","د"][i]}. ${a}</button>`).join("")}<p class="muted tiny">اختر إجابة واحدة للمتابعة.</p></div>`;
  $("quizArea").querySelectorAll("[data-answer]").forEach(b=>b.onclick=()=>{
    const choice=Number(b.dataset.answer);if(choice===q.c)activeQuiz.score++;
    $("quizArea").querySelectorAll(".answer").forEach(x=>{x.disabled=true;if(Number(x.dataset.answer)===q.c)x.classList.add("correct");else if(x===b)x.classList.add("wrong");});
    const next=document.createElement("button");next.className="primary";next.style.marginTop="10px";next.textContent=activeQuiz.index===qz.length-1?"عرض النتيجة":"السؤال التالي";$("quizArea").append(next);
    next.onclick=()=>{activeQuiz.index++;renderQuestion();};
  });
}
document.querySelectorAll("[data-quiz]").forEach(b=>b.addEventListener("click",()=>startQuiz(b.dataset.quiz)));
$("notifyBtn").addEventListener("click",()=>{
  const next=sortLectures(lectures.filter(x=>x.day===dateDay(1)));
  alert(next.length?"محاضرات الغد:\n"+next.map(x=>`${x.time} - ${x.subject} مع ${x.doctor}`).join("\n"):"لا توجد محاضرات مسجلة للغد.");
});

// Google sign-in via redirect: أكثر ملاءمة للمتصفحات على الهاتف.
$("googleLogin").addEventListener("click",async()=>{
  try{await window.firebaseAuth.signInWithRedirect(window.googleProvider);}
  catch(error){console.error(error);alert("تعذر بدء تسجيل الدخول: "+(error.message||error));}
});
$("googleLogout").addEventListener("click",async()=>{
  try{await window.firebaseAuth.signOut();}
  catch(error){console.error(error);alert("تعذر تسجيل الخروج.");}
});
window.firebaseAuth.getRedirectResult().catch(error=>{
  console.error(error);
  $("authStatus").textContent="تعذر إكمال تسجيل الدخول. تحقق من إعدادات Google في Firebase.";
});

function watchSummaries(){
  if(summariesUnsubscribe){summariesUnsubscribe();summariesUnsubscribe=null;}
  if(!currentUser){summaries=[];renderPdfs();return;}
  summariesUnsubscribe=window.firebaseDb.collection("summaries").onSnapshot(snapshot=>{
    summaries=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
    summaries.sort((a,b)=>{
      const ta=a.createdAt&&a.createdAt.toMillis?a.createdAt.toMillis():0;
      const tb=b.createdAt&&b.createdAt.toMillis?b.createdAt.toMillis():0;
      return tb-ta;
    });
    renderPdfs();
  },error=>{
    console.error(error);
    $("libraryNotice").textContent="تعذر تحميل الملخصات. راجع قواعد Firestore واتصال الإنترنت.";
  });
}
window.firebaseAuth.onAuthStateChanged(user=>{
  currentUser=user||null;
  isAdmin=!!(user&&user.email&&user.email.toLowerCase()===window.ADMIN_EMAIL.toLowerCase());
  $("googleLogin").hidden=!!user;
  $("googleLogout").hidden=!user;
  $("userInfo").hidden=!user;
  $("authStatus").textContent=user?"تم تسجيل الدخول بنجاح.": "لم تسجل الدخول بعد.";
  $("signedInEmail").textContent=user?user.email:"";
  $("userRole").textContent=user?(isAdmin?"أنت المشرف الإداري.":"حساب طالب — مشاهدة وتنزيل فقط."):"";
  if(user&& !user.emailVerified && user.providerData.some(p=>p.providerId==="password")){
    $("authStatus").textContent="يرجى التحقق من البريد الإلكتروني.";
  }
  if(!user){$("uploadLabel").hidden=true;}
  renderSchedule();
  watchSummaries();
});

if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
render();
