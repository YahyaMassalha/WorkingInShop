// static/script.js

// ——— تعاريف عناصر DOM ———
const calendarEl     = document.getElementById("calendar");
const monthYearEl    = document.getElementById("month-year");
const prevBtn        = document.getElementById("prev-month");
const nextBtn        = document.getElementById("next-month");
const balanceEl      = document.getElementById("balance");
const salaryEl       = document.getElementById("salary");
const receiveBtn     = document.getElementById("receive-btn");
const addBalBtn      = document.getElementById("add-balance");
const subBalBtn      = document.getElementById("sub-balance");
const addSalBtn      = document.getElementById("add-salary");
const subSalBtn      = document.getElementById("sub-salary");

// ——— Modals ———
const popup          = document.getElementById("popup");
const inputModal     = document.getElementById("input-modal");
const notifyModal    = document.getElementById("notify-modal");

// ——— Popup internals ———
const selectedDateEl = document.getElementById("selected-date");
const dayNameEl      = document.getElementById("day-name");
const dayInfoEl      = document.getElementById("day-info");
const enterHoursBtn  = document.getElementById("enter-hours-btn");
const markDoneBtn    = document.getElementById("mark-done-btn");
const setAbsentBtn   = document.getElementById("set-absent-btn");
const cancelDoneBtn  = document.getElementById("cancel-done-btn");
const hoursForm      = document.getElementById("hours-form");
const startHourInput = document.getElementById("start-hour");
const startMinInput  = document.getElementById("start-minute");
const endHourInput   = document.getElementById("end-hour");
const endMinInput    = document.getElementById("end-minute");
const saveHoursBtn   = document.getElementById("save-hours-btn");
const cancelBtn      = document.getElementById("cancel-btn");

// ——— Input‑modal internals ———
const inputTitle     = document.getElementById("input-title");
const inputValue     = document.getElementById("input-value");
const inputOk        = document.getElementById("input-ok");
const inputCancel    = document.getElementById("input-cancel");

// ——— Notify‑modal internals ———
const notifyMsg      = document.getElementById("notify-message");
const notifyOk       = document.getElementById("notify-ok");

let currentDate  = new Date();
let daysData     = [];
let selectedDate = null;
const hourlyRate = 20;

// ——— دوال الـ API (مسارات نسبية) ———
async function apiGet(endpoint) {
  const res = await fetch(`/api${endpoint}`);
  return res.json();
}
async function apiPost(endpoint, body) {
  const res = await fetch(`/api${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ——— عرض إشعار ———
function showNotification(msg) {
  notifyMsg.textContent = msg;
  notifyModal.classList.remove("hidden");
  notifyOk.onclick = () => notifyModal.classList.add("hidden");
}

// ——— إظهار مربع إدخال مبالغ ———
function showInputPrompt(title, callback) {
  inputTitle.textContent = title;
  inputValue.value = "";
  inputModal.classList.remove("hidden");
  inputOk.onclick = () => {
    const v = parseFloat(inputValue.value);
    if (isNaN(v)) {
      showNotification("أدخل رقمًا صحيحًا");
      return;
    }
    inputModal.classList.add("hidden");
    callback(v);
  };
  inputCancel.onclick = () => inputModal.classList.add("hidden");
}

// ——— تحميل بيانات المحفظة ———
async function loadWallet() {
  const w = await apiGet("/get-wallet");
  balanceEl.textContent = w.balance;
  window._salaryAdj = w.salary_adjustment;
}

// ——— تعديل رصيد المحفظة ———
function modifyWallet(sign) {
  showInputPrompt("أدخل المبلغ:", async val => {
    await apiPost("/modify-wallet", { amount: sign * val });
    await loadWallet();
    await loadDays();
    showNotification(`${sign > 0 ? "أضيف" : "أُزيل"} ${val} ش.ج`);
  });
}

// ——— تعديل التعديل على الراتب ———
function modifySalary(sign) {
  showInputPrompt("أدخل المبلغ:", async val => {
    await apiPost("/modify-salary", { amount: sign * val });
    await loadWallet();
    await loadDays();
    showNotification(`${sign > 0 ? "زدّدت" : "خصمت"} ${val} ش.ج`);
  });
}

// ——— استلام الراتب ———
receiveBtn.onclick = async () => {
  const r = await apiPost("/receive-salary", {});
  await loadWallet();
  await loadDays();
  showNotification(`استلمت ${r.received} ش.ج`);
};

// ——— ربط أزرار الملخص ———
addBalBtn.onclick = () => modifyWallet(+1);
subBalBtn.onclick = () => modifyWallet(-1);
addSalBtn.onclick = () => modifySalary(+1);
subSalBtn.onclick = () => modifySalary(-1);

// ——— تحميل الأيام من السيرفر ———
async function loadDays() {
  daysData = await apiGet("/get-days");
  renderCalendar();
}

// ——— رسم التقويم ———
function renderCalendar() {
  const Y     = currentDate.getFullYear(),
        M     = currentDate.getMonth(),
        first = new Date(Y, M, 1).getDay(),
        dim   = new Date(Y, M + 1, 0).getDate();

  monthYearEl.textContent = currentDate
    .toLocaleDateString("ar", { month: "long", year: "numeric" });
  calendarEl.innerHTML = "";

  // خلايا فارغة قبل أول يوم
  for (let i = 0; i < first; i++) {
    const empty = document.createElement("div");
    empty.className = "day";
    calendarEl.appendChild(empty);
  }

  // حساب مجموع الراتب المكتمل
  let sumDone = 0;
  daysData.forEach(d => {
    if (d.status === "done") sumDone += d.salary;
  });
  salaryEl.textContent = sumDone + (window._salaryAdj || 0);

  // اليوم الحالي كسلسلة
  const today = new Date();
  const todayStr =
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // رسم كل يوم
  for (let d = 1; d <= dim; d++) {
    const ds  = `${Y}-${String(M+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const rec = daysData.find(x => x.date === ds) || {};

    const wrapper = document.createElement("div");
    wrapper.className = "day";
    if (ds === todayStr) wrapper.classList.add("today");

    const btn = document.createElement("button");
    btn.textContent  = d;
    btn.dataset.date = ds;

    // تطبيق لون الحالة
    if (rec.status && rec.status !== "none") {
      btn.classList.add(
        rec.status === "paid"   ? "paid"   :
        rec.status === "done"   ? "worked" :
        rec.status === "absent" ? "absent" :
                                  "pending"
      );
    }

    btn.onclick = () => {
      selectedDate = ds;
      selectedDateEl.textContent = ds;
      dayNameEl.textContent = new Date(ds)
        .toLocaleDateString("ar", { weekday: "long" });

      // عرض معلومات الساعات
      if (rec.start && rec.end) {
        dayInfoEl.textContent = `الساعات: ${rec.start} – ${rec.end}`;
      } else {
        dayInfoEl.textContent = "لم يتم تسجيل ساعات بعد";
      }

      // إخفاء جميع الأزرار أولًا
      [enterHoursBtn, markDoneBtn, setAbsentBtn, cancelDoneBtn].forEach(b => b.hidden = true);
      hoursForm.hidden = true;

      // إظهار الأزرار بحسب الحالة
      const st = rec.status || "none";
      if (st === "none") {
        enterHoursBtn.hidden = false;
      } else if (st === "pending") {
        enterHoursBtn.hidden = false;
        markDoneBtn.hidden   = false;
        setAbsentBtn.hidden  = false;
      } else if (st === "done") {
        cancelDoneBtn.hidden = false;
      }
      // حالات paid/absent لا يظهر لها أزرار إضافية

      popup.classList.remove("hidden");
    };

    wrapper.appendChild(btn);
    calendarEl.appendChild(wrapper);
  }
}

// ——— أزرار تنقل بين الأشهر ———
prevBtn.onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
};
nextBtn.onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
};
cancelBtn.onclick = () => popup.classList.add("hidden");

// ——— إظهار نموذج إدخال الساعات ———
enterHoursBtn.onclick = () => {
  [startHourInput, startMinInput, endHourInput, endMinInput].forEach(i => i.value = "");
  hoursForm.hidden = false;
};

// ——— حفظ أو مسح الساعات ———
saveHoursBtn.onclick = async () => {
  let sh = startHourInput.value.trim(),
      sm = startMinInput.value.trim(),
      eh = endHourInput.value.trim(),
      em = endMinInput.value.trim();

  // لو الحقول خالية كلّها → اعادة اليوم إلى بياض
  if (!sh && !sm && !eh && !em) {
    await apiPost("/save-day", {
      date: selectedDate,
      status: "none",
      start: "",
      end: "",
      salary: 0
    });
    popup.classList.add("hidden");
    loadDays();
    showNotification("تم إزالة الساعات؛ عاد اليوم أبيض");
    return;
  }

  // ملء القيم الفارغة بــ 0
  if (sh && !sm) sm = "0";
  if (eh && !em) em = "0";
  if (!sh && sm) sh = "0";
  if (!eh && em) eh = "0";

  const [sH, sM, eH, eM] = [sh, sm, eh, em].map(v => parseInt(v, 10));

  // التحقق من الصحة
  if ([sH, sM, eH, eM].some(v => isNaN(v) || v < 0 || (v > 23 && (v === sH || v === eH)) || (v > 59 && (v === sM || v === eM)))) {
    showNotification("تأكد من الأرقام: ساعات 0–23، دقائق 0–59");
    return;
  }
  const diff = (eH * 60 + eM) - (sH * 60 + sM);
  if (diff <= 0) {
    showNotification("الوقت غير منطقي");
    return;
  }

  const startStr = `${String(sH).padStart(2,"0")}:${String(sM).padStart(2,"0")}`;
  const endStr   = `${String(eH).padStart(2,"0")}:${String(eM).padStart(2,"0")}`;
  const sal      = parseFloat(((diff / 60) * hourlyRate).toFixed(2));

  await apiPost("/save-day", {
    date: selectedDate,
    start: startStr,
    end: endStr,
    salary: sal,
    status: "pending"
  });

  popup.classList.add("hidden");
  loadDays();
  showNotification("تم حفظ الساعات (pending)");
};

// ——— تمييز كغياب ———
setAbsentBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/save-day", {
    date: selectedDate,
    status: "absent",
    start: rec.start || "",
    end: rec.end   || "",
    salary: rec.salary || 0
  });
  popup.classList.add("hidden");
  loadDays();
  showNotification("تم تمييز اليوم كـ 'لم يتم العمل'");
};

// ——— تأكيد العمل ———
markDoneBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/save-day", {
    date: selectedDate,
    status: "done",
    salary: rec.salary || 0
  });
  popup.classList.add("hidden");
  loadDays();
  showNotification("تم وضع اليوم كمكتمل");
};

// ——— تراجع عن تأكيد العمل ———
cancelDoneBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/save-day", {
    date: selectedDate,
    status: "pending",
    start: rec.start || "",
    end: rec.end   || "",
    salary: rec.salary || 0
  });
  popup.classList.add("hidden");
  loadDays();
  showNotification("تم التراجع عن حالة 'مكتمل'");
};

// ——— التهيئة عند تحميل الصفحة ———
window.addEventListener("DOMContentLoaded", () => {  
  loadWallet();
  loadDays();
});
