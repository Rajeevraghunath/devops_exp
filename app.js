const STORE_KEY = "paisa-expense-tracker-v1";
const defaults = [
  ["Food", "●", "#e8b44e", "#fbf2df", 6000], ["Groceries", "✳", "#205943", "#e8f1e9", 8000],
  ["Transport", "↗", "#70aeb0", "#e5f2f1", 3500], ["Rent", "⌂", "#e77b61", "#faece7", 18000],
  ["Bills & utilities", "ϟ", "#a394c1", "#f0edf7", 3000], ["Shopping", "◇", "#c98361", "#f8eee8", 4000],
  ["Health", "+", "#8dad75", "#edf3e8", 2500], ["Entertainment", "▷", "#d38f9e", "#f8edf0", 2500],
  ["Education", "▤", "#8b9baf", "#edf0f5", 2000], ["Travel", "⌁", "#5996a4", "#e8f1f2", 5000],
  ["EMI & loans", "↻", "#af9871", "#f4f0e7", 7000], ["Other", "···", "#9ba69b", "#eff1ee", 2000]
].map(([name, icon, color, pale, budget]) => ({ name, icon, color, pale, budget }));
const demoTransactions = [
  ["Rent", 16000, "2026-11-01", "Bank transfer", "November rent"], ["Groceries", 2450, "2026-11-12", "UPI", "Weekly groceries"],
  ["Food", 680, "2026-11-12", "UPI", "Dinner with friends"], ["Bills & utilities", 1890, "2026-11-10", "UPI", "Electricity bill"],
  ["Shopping", 2399, "2026-11-09", "Card", "Running shoes"], ["Health", 740, "2026-11-08", "UPI", "Pharmacy"],
  ["Food", 420, "2026-11-07", "UPI", "Lunch"], ["Entertainment", 560, "2026-11-05", "Card", "Movie tickets"],
  ["Transport", 260, "2026-11-04", "UPI", "Auto ride"]
].map(([category, amount, date, mode, note], index) => ({ id: `demo-${index}`, type: "expense", category, amount, date, mode, note }));

function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) return { ...saved, categories: saved.categories || defaults, transactions: saved.transactions || [], budgets: saved.budgets || { overall: 45000 }, settings: saved.settings || { currency: "INR", monthStart: 1 } };
  } catch (error) { console.warn("Local data could not be read", error); }
  return { categories: defaults, transactions: demoTransactions, budgets: { overall: 45000, ...Object.fromEntries(defaults.map(category => [category.name, category.budget])) }, settings: { currency: "INR", monthStart: 1, income: "", reminder: false, weekly: true }, alerts: [] };
}

let state = initialState();
let month = new Date();
month = new Date(month.getFullYear(), month.getMonth(), 1);
let lastCategory = state.lastCategory || "Food";
let selectedCategory = "Food";
let entryType = "expense";
let editingId = null;
let toastTimer;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const monthKey = () => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
const monthItems = () => state.transactions.filter(item => item.date.slice(0, 7) === monthKey());
const expenses = items => (items || monthItems()).filter(item => item.type !== "income");
const sum = items => items.reduce((total, item) => total + Number(item.amount || 0), 0);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const categoryOf = name => state.categories.find(category => category.name === name) || defaults[defaults.length - 1];
const currency = () => state.settings.currency || "INR";
const money = amount => new Intl.NumberFormat("en-IN", { style: "currency", currency: currency(), maximumFractionDigits: 0 }).format(Number(amount) || 0);
const symbol = () => new Intl.NumberFormat("en-IN", { style: "currency", currency: currency(), maximumFractionDigits: 0 }).formatToParts(0).find(part => part.type === "currency")?.value || "₹";
const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function totalsByCategory(items = expenses()) { return state.categories.map(category => ({ category, amount: sum(items.filter(item => item.category === category.name)) })).filter(row => row.amount); }

function render() {
  const label = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  $("#currentMonth").textContent = label;
  $("#transactionMonthLabel").textContent = label.toUpperCase();
  $("#donutCaption").textContent = `${label} · expenses`;
  renderDashboard(); renderTransactions(); renderBudgets(); renderInsights(); renderSettings(); renderPicker();
}

function renderDashboard() {
  const spent = sum(expenses());
  const limit = Number(state.budgets.overall || 0);
  const percent = limit ? Math.round(spent / limit * 100) : 0;
  $("#totalSpent").textContent = money(spent);
  $("#budgetTotal").textContent = money(limit);
  $("#remainingTotal").textContent = money(Math.max(0, limit - spent));
  $("#budgetPercent").textContent = `${percent}%`;
  const progress = $("#overallProgress");
  progress.style.width = `${Math.min(100, percent)}%`;
  progress.parentElement.classList.toggle("warning", percent >= 80 && percent < 100);
  progress.parentElement.classList.toggle("over", percent >= 100);
  $("#topCategories").innerHTML = totalsByCategory().sort((a, b) => b.amount - a.amount).slice(0, 4).map(({ category, amount }, _, rows) => `<div class="category-line"><span class="category-icon" style="background:${category.pale};color:${category.color}">${safe(category.icon)}</span><span class="category-name">${safe(category.name)}</span><span class="category-meter"><i style="width:${Math.max(4, amount / (rows[0]?.amount || 1) * 100)}%;background:${category.color}"></i></span><span class="category-amount">${money(amount)}</span></div>`).join("") || `<div class="empty-state">No expenses this month yet.</div>`;
  const latest = [...monthItems()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#recentTransactions").innerHTML = latest.map(transactionMarkup).join("") || `<div class="empty-state">No activity this month yet.</div>`;
  const food = totalsByCategory().find(row => row.category.name === "Food")?.amount || 0;
  $("#insightCopy").textContent = `Your food spend is ${money(food)} this month. Every small choice is adding up.`;
  const now = new Date();
  $("#todayLabel").textContent = now.toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const logged = new Set(expenses().map(item => item.date));
  $("#weekDots").innerHTML = ["M", "T", "W", "T", "F", "S", "S"].map((day, index) => {
    const date = new Date(monday); date.setDate(monday.getDate() + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const isToday = date.toDateString() === now.toDateString();
    return `<span class="day-dot ${logged.has(key) ? "logged" : ""} ${isToday ? "today" : ""}" aria-label="${day}"><i></i>${day}</span>`;
  }).join("");
}

function transactionMarkup(item) {
  const category = categoryOf(item.category);
  const income = item.type === "income";
  return `<div class="transaction-row" data-transaction-id="${safe(item.id)}"><span class="transaction-symbol" style="background:${category.pale};color:${category.color}">${safe(category.icon)}</span><span class="transaction-copy"><strong>${safe(item.note || item.category)}</strong><small>${safe(item.category)} · ${safe(item.mode || "UPI")}</small></span><span class="transaction-date">${dateLabel(item.date)}</span><span class="transaction-amount ${income ? "income" : ""}">${income ? "+" : "−"}${money(item.amount)}</span><span class="row-actions"><button class="row-action edit-transaction" aria-label="Edit transaction">✎</button><button class="row-action delete-transaction" aria-label="Delete transaction">×</button></span></div>`;
}

function renderTransactions() {
  const categoryFilter = $("#categoryFilter");
  const previous = categoryFilter.value;
  categoryFilter.innerHTML = `<option value="all">All categories</option>${state.categories.map(category => `<option value="${safe(category.name)}">${safe(category.name)}</option>`).join("")}`;
  categoryFilter.value = state.categories.some(category => category.name === previous) ? previous : "all";
  const query = $("#transactionSearch").value.trim().toLowerCase();
  const mode = $("#modeFilter").value;
  const rows = monthItems().filter(item => `${item.note} ${item.category} ${item.mode}`.toLowerCase().includes(query) && (categoryFilter.value === "all" || item.category === categoryFilter.value) && (mode === "all" || item.mode === mode)).sort((a, b) => b.date.localeCompare(a.date));
  $("#allTransactions").innerHTML = rows.map(transactionMarkup).join("");
  $("#emptyTransactions").classList.toggle("hidden", rows.length > 0);
}

function renderBudgets() {
  const spent = sum(expenses());
  const limit = Number(state.budgets.overall || 0);
  $("#budgetSpentLabel").innerHTML = `${money(spent)} <span>spent</span>`;
  $("#budgetLeftLabel").textContent = `${money(Math.max(0, limit - spent))} left this month`;
  if (document.activeElement !== $("#overallBudgetInput")) $("#overallBudgetInput").value = limit;
  const percent = limit ? spent / limit * 100 : 0;
  const overall = $("#budgetPageProgress");
  overall.style.width = `${Math.min(100, percent)}%`;
  overall.parentElement.classList.toggle("warning", percent >= 80 && percent < 100);
  overall.parentElement.classList.toggle("over", percent >= 100);
  $("#budgetList").innerHTML = state.categories.map(category => {
    const amount = sum(expenses().filter(item => item.category === category.name));
    const budget = Number(state.budgets[category.name] || 0);
    const ratio = budget ? amount / budget * 100 : 0;
    const level = ratio >= 100 ? "over" : ratio >= 80 ? "warning" : "";
    return `<div class="budget-item"><span class="category-icon" style="background:${category.pale};color:${category.color}">${safe(category.icon)}</span><span class="budget-item-copy"><strong>${safe(category.name)}</strong><small>${money(amount)} of ${money(budget)}</small></span><label class="money-input" aria-label="${safe(category.name)} monthly budget"><span>${symbol()}</span><input type="number" min="0" step="500" value="${budget}" data-budget-category="${safe(category.name)}"></label><span class="budget-track ${level}"><span style="width:${Math.min(100, ratio)}%"></span></span></div>`;
  }).join("");
}

function renderInsights() {
  const rows = totalsByCategory().sort((a, b) => b.amount - a.amount);
  const grand = sum(expenses());
  $("#donutTotal").textContent = money(grand);
  $("#donutCenter").textContent = money(grand);
  let cursor = 0;
  const segments = rows.map(row => { const start = cursor; cursor += row.amount / (grand || 1) * 100; return `${row.category.color} ${start}% ${cursor}%`; });
  $("#donutChart").style.background = segments.length ? `conic-gradient(${segments.join(",")})` : "#e9ede7";
  $("#chartLegend").innerHTML = rows.slice(0, 6).map(row => `<div class="legend-item"><i style="background:${row.category.color}"></i><span>${safe(row.category.name)}</span><strong>${Math.round(row.amount / (grand || 1) * 100)}%</strong></div>`).join("") || `<div class="empty-state">No expenses yet</div>`;
  const days = Array.from({ length: 30 }, (_, index) => sum(expenses().filter(item => Number(item.date.slice(-2)) === index + 1)));
  const max = Math.max(...days, 1);
  $("#dailyChart").innerHTML = days.map((amount, index) => `<span class="bar-column ${index + 1 === new Date().getDate() ? "today" : ""}" title="${index + 1}: ${money(amount)}"><i style="height:${amount ? Math.max(3, amount / max * 100) : 2}%"></i></span>`).join("");
  const top = rows.slice(0, 2);
  $("#monthlyInsight").textContent = top.length ? `${top.map(row => row.category.name.toLowerCase()).join(" and ")} ${top.length > 1 ? "are" : "is"} your biggest spending ${top.length > 1 ? "categories" : "category"} this month, at ${money(top.reduce((value, row) => value + row.amount, 0))} combined.` : "Your month is a blank page. Log your first expense to start seeing patterns.";
}

function renderSettings() {
  $("#currencySetting").value = currency();
  $("#monthStartSetting").value = String(state.settings.monthStart || 1);
  $("#incomeSetting").value = state.settings.income || "";
  $("#incomeCurrency").textContent = symbol();
  $("#entryCurrency").textContent = symbol();
  $("#reminderSetting").checked = Boolean(state.settings.reminder);
  $("#weeklySetting").checked = state.settings.weekly !== false;
}

function renderPicker() {
  $("#categoryPicker").innerHTML = state.categories.filter(category => !category.hidden).map(category => `<button type="button" class="category-choice ${selectedCategory === category.name ? "selected" : ""}" data-category="${safe(category.name)}"><i style="background:${category.color}"></i>${safe(category.name)}</button>`).join("");
}

function notify(message, actionText = "", action = null) {
  const toast = $("#toast");
  toast.innerHTML = `${safe(message)}${actionText ? `<button id="toastAction" type="button">${safe(actionText)}</button>` : ""}`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  if (action) $("#toastAction").addEventListener("click", action, { once: true });
  toastTimer = setTimeout(() => toast.classList.remove("show"), actionText ? 5000 : 2800);
}

function removeTransaction(id) {
  const index = state.transactions.findIndex(item => item.id === id);
  if (index < 0) return;
  const [removed] = state.transactions.splice(index, 1);
  persist(); render();
  notify("Transaction deleted", "Undo", () => { state.transactions.splice(index, 0, removed); persist(); render(); notify("Transaction restored"); });
}

function budgetAlerts() {
  const monthId = monthKey();
  state.alerts ||= [];
  const budgets = [{ name: "Overall budget", limit: Number(state.budgets.overall || 0), amount: sum(expenses()) }, ...state.categories.map(category => ({ name: category.name, limit: Number(state.budgets[category.name] || 0), amount: sum(expenses().filter(item => item.category === category.name)) }))];
  for (const budget of budgets) for (const threshold of [80, 100]) {
    const key = `${monthId}:${budget.name}:${threshold}`;
    if (budget.limit && budget.amount / budget.limit * 100 >= threshold && !state.alerts.includes(key)) {
      state.alerts.push(key); notify(`${budget.name} reached ${threshold}%`);
    }
  }
  persist();
}

function navigate(view) {
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$('[data-view]').forEach(button => button.classList.toggle("active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openEntry(item = null) {
  editingId = item?.id || null;
  entryType = item?.type || "expense";
  selectedCategory = item?.category || lastCategory;
  $("#entryTitle").innerHTML = `${item ? "Edit transaction" : "Log a spend"}<span class="heading-spark">.</span>`;
  $("#amountInput").value = item?.amount || "";
  $("#dateInput").value = item?.date || new Date().toISOString().slice(0, 10);
  $("#modeInput").value = item?.mode || "UPI";
  $("#noteInput").value = item?.note || "";
  $("#deleteEntry").classList.toggle("hidden", !item);
  $$(".type-option").forEach(button => button.classList.toggle("active", button.dataset.type === entryType));
  renderPicker();
  $("#entryDialog").showModal();
  setTimeout(() => $("#amountInput").focus(), 30);
}

function bindTransactionList(selector) {
  $(selector).addEventListener("click", event => {
    const row = event.target.closest("[data-transaction-id]");
    if (!row) return;
    const item = state.transactions.find(transaction => transaction.id === row.dataset.transactionId);
    if (event.target.closest(".edit-transaction")) openEntry(item);
    if (event.target.closest(".delete-transaction")) removeTransaction(item.id);
  });
}

$$('[data-view]').forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
$$('[data-goto]').forEach(button => button.addEventListener("click", () => navigate(button.dataset.goto)));
$$('[data-add]').forEach(button => button.addEventListener("click", () => openEntry()));
$("#quickAdd").addEventListener("click", () => openEntry());
$("#overviewAdd").addEventListener("click", () => openEntry());
$("#mobileAdd").addEventListener("click", () => openEntry());
$("#previousMonth").addEventListener("click", () => { month.setMonth(month.getMonth() - 1); render(); });
$("#nextMonth").addEventListener("click", () => { month.setMonth(month.getMonth() + 1); render(); });
$("#transactionSearch").addEventListener("input", renderTransactions);
$("#categoryFilter").addEventListener("change", renderTransactions);
$("#modeFilter").addEventListener("change", renderTransactions);
bindTransactionList("#allTransactions"); bindTransactionList("#recentTransactions");
$("#categoryPicker").addEventListener("click", event => { const button = event.target.closest("[data-category]"); if (button) { selectedCategory = button.dataset.category; renderPicker(); } });
$$('.type-option').forEach(button => button.addEventListener("click", () => {
  entryType = button.dataset.type;
  $$('.type-option').forEach(option => option.classList.toggle("active", option === button));
  $("#entryTitle").innerHTML = `${entryType === "income" ? "Add income" : "Log a spend"}<span class="heading-spark">.</span>`;
}));
$("#entryForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number($("#amountInput").value);
  if (!amount || amount <= 0) { $("#amountInput").focus(); return; }
  const item = { id: editingId || `tx-${Date.now()}`, type: entryType, amount, category: selectedCategory, date: $("#dateInput").value, mode: $("#modeInput").value, note: $("#noteInput").value.trim().slice(0, 200) };
  const index = state.transactions.findIndex(transaction => transaction.id === editingId);
  if (index < 0) state.transactions.push(item); else state.transactions[index] = item;
  lastCategory = selectedCategory;
  state.lastCategory = lastCategory;
  persist(); $("#entryDialog").close(); render(); budgetAlerts(); notify(index < 0 ? "Entry saved" : "Transaction updated");
});
$("#deleteEntry").addEventListener("click", () => { if (editingId) removeTransaction(editingId); $("#entryDialog").close(); });
$("#closeDialog").addEventListener("click", () => $("#entryDialog").close());
$("#cancelEntry").addEventListener("click", () => $("#entryDialog").close());
$("#entryDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
$("#overallBudgetInput").addEventListener("change", event => { state.budgets.overall = Math.max(0, Number(event.target.value)); persist(); render(); notify("Monthly budget updated"); });
$("#budgetList").addEventListener("change", event => { const name = event.target.dataset.budgetCategory; if (!name) return; state.budgets[name] = Math.max(0, Number(event.target.value)); persist(); render(); notify(`${name} budget updated`); });
$("#resetBudgets").addEventListener("click", () => { state.budgets = { overall: 45000, ...Object.fromEntries(defaults.map(category => [category.name, category.budget])) }; persist(); render(); notify("Monthly plan restored"); });
$("#currencySetting").addEventListener("change", event => { state.settings.currency = event.target.value; persist(); render(); });
$("#monthStartSetting").addEventListener("change", event => { state.settings.monthStart = Number(event.target.value); persist(); notify("Month start updated"); });
$("#incomeSetting").addEventListener("change", event => { state.settings.income = event.target.value; persist(); notify("Income preference saved"); });
$("#reminderSetting").addEventListener("change", event => { state.settings.reminder = event.target.checked; persist(); notify(event.target.checked ? "Daily reminder turned on" : "Daily reminder turned off"); });
$("#weeklySetting").addEventListener("change", event => { state.settings.weekly = event.target.checked; persist(); notify("Weekly summary preference saved"); });
$("#exportCsv").addEventListener("click", () => {
  const records = [["Date", "Type", "Amount", "Category", "Payment mode", "Note"], ...state.transactions.map(item => [item.date, item.type, item.amount, item.category, item.mode || "", item.note || ""])];
  const csv = records.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = "paisa-transactions.csv"; link.click(); URL.revokeObjectURL(link.href); notify("CSV downloaded");
});
$("#deleteData").addEventListener("click", () => {
  if (!confirm("Delete all transactions and preferences stored on this device? This cannot be undone.")) return;
  localStorage.removeItem(STORE_KEY);
  state = { categories: defaults, transactions: [], budgets: { overall: 45000, ...Object.fromEntries(defaults.map(category => [category.name, category.budget])) }, settings: { currency: "INR", monthStart: 1, income: "", reminder: false, weekly: true }, alerts: [] };
  lastCategory = "Food";
  persist(); render(); notify("Local data deleted");
});
render();
