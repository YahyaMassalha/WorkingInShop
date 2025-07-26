// script.js

// DOM references
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

// Modals
const popup          = document.getElementById("popup");
const inputModal     = document.getElementById("input-modal");
const notifyModal    = document.getElementById("notify-modal");

// Popup internals
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

// Input‑modal internals
const inputTitle     = document.getElementById("input-title");
const inputValue     = document.getElementById("input-value");
const inputOk        = document.getElementById("input-ok");
const inputCancel    = document.getElementById("input-cancel");

// Notify‑modal internals
const notifyMsg      = document.getElementById("notify-message");
const notifyOk       = document.getElementById("notify-ok");

let currentDate  = new Date();
let daysData     = [];
let selectedDate = null;
const hourlyRate = 20;

// API helpers
async function apiGet(path){
  return (await fetch(`http://127.0.0.1:5000${path}`)).json();
}
async function apiPost(path, body){
  return (await fetch(`http://127.0.0.1:5000${path}`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  })).json();
}

// Show notification
function showNotification(msg){
  notifyMsg.textContent = msg;
  notifyModal.classList.remove("hidden");
  notifyOk.onclick = () => notifyModal.classList.add("hidden");
}

// Input prompt
function showInputPrompt(title, callback){
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

// Load wallet data
async function loadWallet(){
  const w = await apiGet("/api/get-wallet");
  balanceEl.textContent = w.balance;
  window._salaryAdj = w.salary_adjustment;
}

// Modify wallet
function modifyWallet(sign){
  showInputPrompt("أدخل المبلغ:", async val => {
    await apiPost("/api/modify-wallet", { amount: sign * val });
    await loadWallet();
    await loadDays();
    showNotification(`${sign>0?"أضيف":"أُزيل"} ${val} ش.ج`);
  });
}

// Modify salary adjustment
function modifySalary(sign){
  showInputPrompt("أدخل المبلغ:", async val => {
    await apiPost("/api/modify-salary", { amount: sign * val });
    await loadWallet();
    await loadDays();
    showNotification(`${sign>0?"زدّدت":"خصمت"} ${val} ش.ج`);
  });
}

// Receive salary
receiveBtn.onclick = async () => {
  const r = await apiPost("/api/receive-salary", {});
  await loadWallet();
  await loadDays();
  showNotification(`استلمت ${r.received} ش.ج`);
};

// Bind summary actions
addBalBtn.onclick = () => modifyWallet(+1);
subBalBtn.onclick = () => modifyWallet(-1);
addSalBtn.onclick = () => modifySalary(+1);
subSalBtn.onclick = () => modifySalary(-1);

// Load days from server
async function loadDays(){
  daysData = await apiGet("/api/get-days");
  renderCalendar();
}

// Render calendar
function renderCalendar(){
  const Y     = currentDate.getFullYear(),
        M     = currentDate.getMonth(),
        first = new Date(Y, M, 1).getDay(),
        dim   = new Date(Y, M+1, 0).getDate();

  monthYearEl.textContent = currentDate
    .toLocaleDateString("ar", { month:"long", year:"numeric" });
  calendarEl.innerHTML = "";

  // Blank leading cells
  for(let i=0;i<first;i++){
    const empty = document.createElement("div");
    empty.className = "day";
    calendarEl.appendChild(empty);
  }

  // Compute salary sum
  let sumDone = 0;
  daysData.forEach(d => {
    if (d.status === "done") sumDone += d.salary;
  });
  salaryEl.textContent = sumDone + (window._salaryAdj||0);

  // Today string
  const today = new Date();
  const todayStr =
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Render each day
  for(let d=1; d<=dim; d++){
    const ds  = `${Y}-${String(M+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const rec = daysData.find(x => x.date===ds) || {};

    const wrapper = document.createElement("div");
    wrapper.className = "day";

    // Highlight today with wrapper class
    if (ds === todayStr) {
      wrapper.classList.add("today");
    }

    const btn = document.createElement("button");
    btn.textContent  = d;
    btn.dataset.date = ds;

    // Apply status color (overrides nothing)
    if (rec.status && rec.status!=="none") {
      switch(rec.status){
        case "paid":    btn.classList.add("paid");    break;
        case "done":    btn.classList.add("worked");  break;
        case "absent":  btn.classList.add("absent");  break;
        case "pending": btn.classList.add("pending"); break;
      }
    }

    btn.onclick = () => {
      selectedDate = ds;
      selectedDateEl.textContent = ds;
      dayNameEl.textContent = new Date(ds)
        .toLocaleDateString("ar", { weekday:"long" });

      // Hours info
      if (rec.start && rec.end) {
        dayInfoEl.textContent = `الساعات: ${rec.start} – ${rec.end}`;
      } else {
        dayInfoEl.textContent = "لم يتم تسجيل ساعات بعد";
      }

      const st = rec.status || "none";
      // Hide all controls
      enterHoursBtn.hidden = true;
      markDoneBtn.hidden   = true;
      setAbsentBtn.hidden  = true;
      cancelDoneBtn.hidden = true;
      hoursForm.hidden     = true;

      // Show based on status
      if (st === "none") {
        enterHoursBtn.hidden = false;
      } else if (st === "pending") {
        enterHoursBtn.hidden = false;
        markDoneBtn.hidden   = false;
        setAbsentBtn.hidden  = false;
      } else if (st === "done") {
        cancelDoneBtn.hidden = false;
      }
      // absent/paid: no buttons

      popup.classList.remove("hidden");
    };

    wrapper.appendChild(btn);
    calendarEl.appendChild(wrapper);
  }
}

// Navigation
prevBtn.onclick   = () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); };
nextBtn.onclick   = () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); };
cancelBtn.onclick = () => popup.classList.add("hidden");

// Show hours form
enterHoursBtn.onclick = () => {
  startHourInput.value = "";
  startMinInput .value = "";
  endHourInput  .value = "";
  endMinInput   .value = "";
  hoursForm.hidden     = false;
};

// Save or clear hours
saveHoursBtn.onclick = async () => {
  let shRaw = startHourInput.value.trim();
  let smRaw = startMinInput .value.trim();
  let ehRaw = endHourInput  .value.trim();
  let emRaw = endMinInput   .value.trim();

  // Clear if all empty
  if (!shRaw && !smRaw && !ehRaw && !emRaw) {
    await apiPost("/api/save-day", {
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

  // Default missing parts to 0
  if (shRaw && !smRaw) smRaw = "0";
  if (ehRaw && !emRaw) emRaw = "0";
  if (!shRaw && smRaw) shRaw = "0";
  if (!ehRaw && emRaw) ehRaw = "0";

  const sh = parseInt(shRaw,10),
        sm = parseInt(smRaw,10),
        eh = parseInt(ehRaw,10),
        em = parseInt(emRaw,10);

  // Validate
  if (
    isNaN(sh)||isNaN(sm) ||
    isNaN(eh)||isNaN(em)
  ) {
    showNotification("أكمل جميع الحقول بالساعة والدقيقة");
    return;
  }
  if (
    sh<0||sh>23||eh<0||eh>23||
    sm<0||sm>59||em<0||em>59
  ) {
    showNotification("الوقت خارج المدى (00–23 للساعة، 00–59 للدقيقة)");
    return;
  }

  const diff = (eh*60 + em) - (sh*60 + sm);
  if (diff <= 0) {
    showNotification("الوقت غير منطقي");
    return;
  }

  const startStr = String(sh).padStart(2,"0")+":"+String(sm).padStart(2,"0");
  const endStr   = String(eh).padStart(2,"0")+":"+String(em).padStart(2,"0");
  const sal      = parseFloat(((diff/60)*hourlyRate).toFixed(2));

  await apiPost("/api/save-day", {
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

// Mark absent
setAbsentBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/api/save-day", {
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

// Mark done
markDoneBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/api/save-day", {
    date: selectedDate,
    status: "done",
    salary: rec.salary || 0
  });
  popup.classList.add("hidden");
  loadDays();
  showNotification("تم وضع اليوم كمكتمل");
};

// Cancel done → pending
cancelDoneBtn.onclick = async () => {
  const rec = daysData.find(d => d.date === selectedDate) || {};
  await apiPost("/api/save-day", {
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

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  loadWallet();
  loadDays();
});
