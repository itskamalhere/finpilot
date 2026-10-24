/**
 * FinPilot — Premium Personal Finance Dashboard
 * Core Application Logic, State Management & SVG Rendering Engine
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. Constants, Configuration & Enums
     ========================================================================== */
  const STORAGE_KEYS = {
    TRANSACTIONS: 'finpilot_transactions_v1',
    BUDGETS: 'finpilot_budgets_v1',
    SETTINGS: 'finpilot_settings_v1',
    IS_DEMO: 'finpilot_is_demo_v1'
  };

  const CATEGORIES = {
    income: [
      'Salary',
      'Freelance',
      'Business',
      'Investments',
      'Other Income'
    ],
    expense: [
      'Food',
      'Transport',
      'Shopping',
      'Bills',
      'Housing',
      'Healthcare',
      'Education',
      'Entertainment',
      'Travel',
      'Other Expense'
    ]
  };

  const CATEGORY_COLORS = {
    Food: '#62E6A5',
    Transport: '#75DDF5',
    Shopping: '#FF7D87',
    Bills: '#F5C66E',
    Housing: '#A78BFA',
    Healthcare: '#38BDF8',
    Education: '#818CF8',
    Entertainment: '#F472B6',
    Travel: '#FB923C',
    'Other Expense': '#94A3B8',
    Salary: '#8CF5C6',
    Freelance: '#67E8F9',
    Business: '#60A5FA',
    Investments: '#C084FC',
    'Other Income': '#CBD5E1'
  };

  const CATEGORY_ICONS = {
    Food: '🍽️',
    Transport: '🚗',
    Shopping: '🛍️',
    Bills: '⚡',
    Housing: '🏠',
    Healthcare: '🩺',
    Education: '📚',
    Entertainment: '🎬',
    Travel: '✈️',
    'Other Expense': '📦',
    Salary: '💼',
    Freelance: '💻',
    Business: '🏢',
    Investments: '📈',
    'Other Income': '💵'
  };

  const CURRENCY_CONFIG = {
    INR: { code: 'INR', symbol: '₹', locale: 'en-IN' },
    USD: { code: 'USD', symbol: '$', locale: 'en-US' },
    EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
    GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' }
  };

  /* ==========================================================================
     2. Application State
     ========================================================================== */
  const state = {
    transactions: [],
    budgets: [],
    settings: {
      currency: 'INR',
      theme: 'dark',
      defaultMonth: 'current',
      selectedMonth: ''
    },
    isDemo: false,
    filters: {
      search: '',
      type: 'all',
      category: 'all',
      dateRange: 'all',
      sort: 'date-desc'
    },
    activeView: 'overview',
    cashflowPeriod: 6,
    analyticsRange: 6,
    pendingAction: null,
    pendingTxId: null,
    pendingBudgetId: null,
    pendingImportData: null
  };

  /* ==========================================================================
     3. Currency & Mathematical Helpers (Integer-Paise Safety)
     ========================================================================== */
  /**
   * Converts floating amount to integer paise (or cents)
   * Prevents standard binary floating-point rounding errors
   */
  function toPaise(amount) {
    if (typeof amount !== 'number') {
      amount = parseFloat(amount) || 0;
    }
    return Math.round(amount * 100);
  }

  function fromPaise(paise) {
    return (paise || 0) / 100;
  }

  /**
   * Formats paise integer into localized currency string
   */
  function formatCurrency(paise, currencyCode) {
    const code = currencyCode || state.settings.currency || 'INR';
    const conf = CURRENCY_CONFIG[code] || CURRENCY_CONFIG.INR;
    const decimalAmount = fromPaise(paise);

    try {
      return new Intl.NumberFormat(conf.locale, {
        style: 'currency',
        currency: conf.code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(decimalAmount);
    } catch (e) {
      return `${conf.symbol}${decimalAmount.toFixed(2)}`;
    }
  }

  function getCurrencySymbol() {
    const conf = CURRENCY_CONFIG[state.settings.currency] || CURRENCY_CONFIG.INR;
    return conf.symbol;
  }

  /* ==========================================================================
     4. Date & Time Helpers
     ========================================================================== */
  function getCurrentDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getCurrentMonthString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatMonthHeading(yearMonthStr) {
    if (!yearMonthStr) return '';
    const parts = yearMonthStr.split('-');
    if (parts.length !== 2) return yearMonthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function formatShortMonth(yearMonthStr) {
    if (!yearMonthStr) return '';
    const parts = yearMonthStr.split('-');
    if (parts.length !== 2) return yearMonthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  function getRelativeMonth(yearMonthStr, offset) {
    const parts = yearMonthStr.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;

    month += offset;
    const newDate = new Date(year, month, 1);
    const newY = newDate.getFullYear();
    const newM = String(newDate.getMonth() + 1).padStart(2, '0');
    return `${newY}-${newM}`;
  }

  function getMonthList(endMonthStr, count) {
    const list = [];
    for (let i = count - 1; i >= 0; i--) {
      list.push(getRelativeMonth(endMonthStr, -i));
    }
    return list;
  }

  function generateId(prefix = 'tx') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  /* ==========================================================================
     5. Storage & Validation Helpers
     ========================================================================== */
  function loadFromStorage() {
    try {
      const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (rawSettings) {
        const parsedSettings = JSON.parse(rawSettings);
        if (parsedSettings && typeof parsedSettings === 'object') {
          state.settings = { ...state.settings, ...parsedSettings };
        }
      }
    } catch (err) {
      console.warn('FinPilot: Failed to parse stored settings, restoring defaults', err);
    }

    try {
      const isDemoFlag = localStorage.getItem(STORAGE_KEYS.IS_DEMO);
      state.isDemo = isDemoFlag === 'true';
    } catch (e) {}

    let loadedTxs = [];
    try {
      const rawTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (rawTxs) {
        const parsedTxs = JSON.parse(rawTxs);
        if (Array.isArray(parsedTxs)) {
          loadedTxs = parsedTxs.filter(isValidTransaction);
        }
      }
    } catch (err) {
      console.warn('FinPilot: Failed to parse stored transactions', err);
      loadedTxs = [];
    }

    let loadedBudgets = [];
    try {
      const rawBudgets = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      if (rawBudgets) {
        const parsedBudgets = JSON.parse(rawBudgets);
        if (Array.isArray(parsedBudgets)) {
          loadedBudgets = parsedBudgets.filter(isValidBudget);
        }
      }
    } catch (err) {
      console.warn('FinPilot: Failed to parse stored budgets', err);
      loadedBudgets = [];
    }

    // First-run experience: If no transactions or budgets exist, populate with realistic demo data
    const isFirstRun = !localStorage.getItem(STORAGE_KEYS.TRANSACTIONS) && !localStorage.getItem(STORAGE_KEYS.BUDGETS);
    if (isFirstRun) {
      populateInitialDemoData();
    } else {
      state.transactions = loadedTxs;
      state.budgets = loadedBudgets;
    }

    // Initialize selected month
    const curMonth = getCurrentMonthString();
    if (!state.settings.selectedMonth || state.settings.defaultMonth === 'current') {
      state.settings.selectedMonth = curMonth;
    }
  }

  function isValidTransaction(tx) {
    return (
      tx &&
      typeof tx.id === 'string' &&
      typeof tx.description === 'string' &&
      (typeof tx.amountPaise === 'number' && tx.amountPaise > 0) &&
      (tx.type === 'income' || tx.type === 'expense') &&
      typeof tx.category === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(tx.date)
    );
  }

  function isValidBudget(b) {
    return (
      b &&
      typeof b.id === 'string' &&
      typeof b.category === 'string' &&
      typeof b.limitPaise === 'number' &&
      b.limitPaise > 0
    );
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(state.transactions));
      localStorage.setItem(STORAGE_KEYS.IS_DEMO, String(state.isDemo));
    } catch (err) {
      showToast('Storage quota exceeded. Could not save transactions.', 'error');
    }
  }

  function saveBudgets() {
    try {
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(state.budgets));
    } catch (err) {
      showToast('Storage quota exceeded. Could not save budgets.', 'error');
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
    } catch (err) {
      console.warn('Failed to save settings to localStorage', err);
    }
  }

  /* ==========================================================================
     6. Realistic Demo Dataset Generator
     ========================================================================== */
  function populateInitialDemoData() {
    const curMonth = getCurrentMonthString();
    const prevMonth1 = getRelativeMonth(curMonth, -1);
    const prevMonth2 = getRelativeMonth(curMonth, -2);

    const demoTransactions = [
      // Current Month
      { id: generateId(), description: 'Monthly Tech Salary', amountPaise: toPaise(85000), type: 'income', category: 'Salary', date: `${curMonth}-01`, notes: 'Direct deposit salary credit' },
      { id: generateId(), description: 'Freelance UI Design', amountPaise: toPaise(24500), type: 'income', category: 'Freelance', date: `${curMonth}-07`, notes: 'Client invoice payment for mobile app redesign' },
      { id: generateId(), description: 'Dividend Payout', amountPaise: toPaise(4200), type: 'income', category: 'Investments', date: `${curMonth}-14`, notes: 'Quarterly index fund dividend' },
      { id: generateId(), description: 'Apartment Monthly Rent', amountPaise: toPaise(22000), type: 'expense', category: 'Housing', date: `${curMonth}-02`, notes: 'Direct bank transfer for rent' },
      { id: generateId(), description: 'Supermarket Grocery Restock', amountPaise: toPaise(6840), type: 'expense', category: 'Food', date: `${curMonth}-04`, notes: 'Weekly organic produce and pantry supplies' },
      { id: generateId(), description: 'Fiber Internet & Mobile Plan', amountPaise: toPaise(1899), type: 'expense', category: 'Bills', date: `${curMonth}-06`, notes: 'High-speed broadband monthly auto-pay' },
      { id: generateId(), description: 'Metro Rail Monthly Pass', amountPaise: toPaise(1650), type: 'expense', category: 'Transport', date: `${curMonth}-08`, notes: 'Transit smart card recharge' },
      { id: generateId(), description: 'Ergonomic Desk Accessories', amountPaise: toPaise(3499), type: 'expense', category: 'Shopping', date: `${curMonth}-11`, notes: 'Monitor riser and vertical mouse' },
      { id: generateId(), description: 'Weekend Dinner with Friends', amountPaise: toPaise(2450), type: 'expense', category: 'Food', date: `${curMonth}-13`, notes: 'Bistro dinner' },
      { id: generateId(), description: 'Health & Dental Checkup', amountPaise: toPaise(2100), type: 'expense', category: 'Healthcare', date: `${curMonth}-16`, notes: 'Routine clinic consultation' },
      { id: generateId(), description: 'Streaming & Music Subscriptions', amountPaise: toPaise(799), type: 'expense', category: 'Entertainment', date: `${curMonth}-18`, notes: 'Monthly family digital pack' },
      { id: generateId(), description: 'Online Software Architecture Course', amountPaise: toPaise(3200), type: 'expense', category: 'Education', date: `${curMonth}-20`, notes: 'Professional engineering certification' },

      // Previous Month 1
      { id: generateId(), description: 'Monthly Tech Salary', amountPaise: toPaise(85000), type: 'income', category: 'Salary', date: `${prevMonth1}-01`, notes: 'Salary credit' },
      { id: generateId(), description: 'Freelance Design Consultation', amountPaise: toPaise(18000), type: 'income', category: 'Freelance', date: `${prevMonth1}-10`, notes: 'Website review' },
      { id: generateId(), description: 'Apartment Monthly Rent', amountPaise: toPaise(22000), type: 'expense', category: 'Housing', date: `${prevMonth1}-02`, notes: 'Rent transfer' },
      { id: generateId(), description: 'Groceries & Household Goods', amountPaise: toPaise(11200), type: 'expense', category: 'Food', date: `${prevMonth1}-09`, notes: 'Monthly grocery bill' },
      { id: generateId(), description: 'Electricity & Gas Utility', amountPaise: toPaise(2400), type: 'expense', category: 'Bills', date: `${prevMonth1}-12`, notes: 'Power utility bill' },
      { id: generateId(), description: 'Car Fuel & Maintenance', amountPaise: toPaise(4800), type: 'expense', category: 'Transport', date: `${prevMonth1}-15`, notes: 'Full tank and oil change' },
      { id: generateId(), description: 'Weekend Getaway Lodging', amountPaise: toPaise(7800), type: 'expense', category: 'Travel', date: `${prevMonth1}-22`, notes: 'Hill station weekend trip' },

      // Previous Month 2
      { id: generateId(), description: 'Monthly Tech Salary', amountPaise: toPaise(85000), type: 'income', category: 'Salary', date: `${prevMonth2}-01`, notes: 'Salary credit' },
      { id: generateId(), description: 'Apartment Monthly Rent', amountPaise: toPaise(22000), type: 'expense', category: 'Housing', date: `${prevMonth2}-02`, notes: 'Rent' },
      { id: generateId(), description: 'Monthly Supermarket Runs', amountPaise: toPaise(9800), type: 'expense', category: 'Food', date: `${prevMonth2}-10`, notes: 'Pantry restocking' },
      { id: generateId(), description: 'New Running Shoes', amountPaise: toPaise(4500), type: 'expense', category: 'Shopping', date: `${prevMonth2}-18`, notes: 'Sports running shoes' }
    ];

    const demoBudgets = [
      { id: generateId('b'), category: 'Food', limitPaise: toPaise(14000) },
      { id: generateId('b'), category: 'Housing', limitPaise: toPaise(25000) },
      { id: generateId('b'), category: 'Transport', limitPaise: toPaise(5000) },
      { id: generateId('b'), category: 'Bills', limitPaise: toPaise(4000) },
      { id: generateId('b'), category: 'Shopping', limitPaise: toPaise(6000) },
      { id: generateId('b'), category: 'Entertainment', limitPaise: toPaise(3000) }
    ];

    state.transactions = demoTransactions;
    state.budgets = demoBudgets;
    state.isDemo = true;

    saveTransactions();
    saveBudgets();
  }

  /* ==========================================================================
     7. Financial Calculation Engine
     ========================================================================== */
  function calculateTotalBalance() {
    let totalIncome = 0;
    let totalExpense = 0;
    for (const tx of state.transactions) {
      if (tx.type === 'income') {
        totalIncome += tx.amountPaise;
      } else if (tx.type === 'expense') {
        totalExpense += tx.amountPaise;
      }
    }
    return totalIncome - totalExpense;
  }

  function calculateMonthlyTotals(monthStr) {
    let income = 0;
    let expenses = 0;

    for (const tx of state.transactions) {
      if (tx.date.startsWith(monthStr)) {
        if (tx.type === 'income') {
          income += tx.amountPaise;
        } else if (tx.type === 'expense') {
          expenses += tx.amountPaise;
        }
      }
    }

    const savings = income - expenses;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    // Prior Month comparison
    const priorMonthStr = getRelativeMonth(monthStr, -1);
    let priorIncome = 0;
    let priorExpenses = 0;
    let priorHasTransactions = false;

    for (const tx of state.transactions) {
      if (tx.date.startsWith(priorMonthStr)) {
        priorHasTransactions = true;
        if (tx.type === 'income') priorIncome += tx.amountPaise;
        else if (tx.type === 'expense') priorExpenses += tx.amountPaise;
      }
    }

    return {
      monthStr,
      income,
      expenses,
      savings,
      savingsRate,
      priorMonthStr,
      priorIncome,
      priorExpenses,
      priorHasTransactions
    };
  }

  function getCategoryExpenses(monthStr) {
    const map = {};
    let totalExpenses = 0;

    for (const tx of state.transactions) {
      if (tx.date.startsWith(monthStr) && tx.type === 'expense') {
        map[tx.category] = (map[tx.category] || 0) + tx.amountPaise;
        totalExpenses += tx.amountPaise;
      }
    }

    const result = Object.keys(map).map(category => {
      const amountPaise = map[category];
      const percentage = totalExpenses > 0 ? (amountPaise / totalExpenses) * 100 : 0;
      return {
        category,
        amountPaise,
        percentage
      };
    });

    result.sort((a, b) => b.amountPaise - a.amountPaise);
    return { list: result, totalExpenses };
  }

  function getBudgetsWithActuals(monthStr) {
    return state.budgets.map(budget => {
      let actualSpent = 0;
      for (const tx of state.transactions) {
        if (tx.date.startsWith(monthStr) && tx.type === 'expense' && tx.category === budget.category) {
          actualSpent += tx.amountPaise;
        }
      }

      const remaining = budget.limitPaise - actualSpent;
      const percentage = budget.limitPaise > 0 ? (actualSpent / budget.limitPaise) * 100 : 0;

      let status = 'normal';
      if (percentage >= 100) {
        status = 'danger';
      } else if (percentage >= 80) {
        status = 'warning';
      }

      return {
        ...budget,
        actualSpent,
        remaining,
        percentage,
        status
      };
    });
  }

  /* ==========================================================================
     8. Native SVG Chart Engine
     ========================================================================== */

  /**
   * Render Multi-Month Cash Flow SVG Chart
   */
  function renderCashFlowChart(containerEl, monthsCount, targetMonth) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    const months = getMonthList(targetMonth, monthsCount);
    const data = months.map(m => calculateMonthlyTotals(m));

    let maxVal = 10000; // minimum scale
    data.forEach(d => {
      if (d.income > maxVal) maxVal = d.income;
      if (d.expenses > maxVal) maxVal = d.expenses;
    });

    // Provide headroom
    maxVal = Math.ceil((maxVal * 1.15) / 100000) * 100000;
    if (maxVal === 0) maxVal = 500000;

    const width = containerEl.clientWidth || 600;
    const height = containerEl.clientHeight || 260;
    const padding = { top: 20, right: 20, bottom: 35, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'chart-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Cash flow chart for the past ${monthsCount} months`);

    // Gridlines (4 lines)
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const yVal = (maxVal / gridCount) * i;
      const yPos = padding.top + chartH - (yVal / maxVal) * chartH;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padding.left);
      line.setAttribute('y1', yPos);
      line.setAttribute('x2', width - padding.right);
      line.setAttribute('y2', yPos);
      line.setAttribute('class', 'chart-grid-line');
      svg.appendChild(line);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', padding.left - 8);
      label.setAttribute('y', yPos + 4);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('class', 'chart-axis-text');
      label.textContent = formatCurrency(yVal, state.settings.currency).replace(/\.\d{2}/, '');
      svg.appendChild(label);
    }

    // Bars & Savings Line points
    const groupW = chartW / months.length;
    const barW = Math.max(8, Math.min(22, (groupW - 16) / 2));
    const savingsPoints = [];

    data.forEach((d, idx) => {
      const groupX = padding.left + idx * groupW + groupW / 2;
      const incomeH = (d.income / maxVal) * chartH;
      const expenseH = (d.expenses / maxVal) * chartH;

      // Income Bar
      const incomeX = groupX - barW - 2;
      const incomeY = padding.top + chartH - incomeH;
      const incomeBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      incomeBar.setAttribute('x', incomeX);
      incomeBar.setAttribute('y', incomeY);
      incomeBar.setAttribute('width', barW);
      incomeBar.setAttribute('height', Math.max(0, incomeH));
      incomeBar.setAttribute('class', 'chart-bar-income');
      incomeBar.setAttribute('tabindex', '0');
      incomeBar.setAttribute('aria-label', `${formatMonthHeading(d.monthStr)} Income: ${formatCurrency(d.income)}`);
      addChartTooltip(incomeBar, `${formatMonthHeading(d.monthStr)}<br>Income: <strong>${formatCurrency(d.income)}</strong>`, containerEl);
      svg.appendChild(incomeBar);

      // Expense Bar
      const expenseX = groupX + 2;
      const expenseY = padding.top + chartH - expenseH;
      const expenseBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      expenseBar.setAttribute('x', expenseX);
      expenseBar.setAttribute('y', expenseY);
      expenseBar.setAttribute('width', barW);
      expenseBar.setAttribute('height', Math.max(0, expenseH));
      expenseBar.setAttribute('class', 'chart-bar-expense');
      expenseBar.setAttribute('tabindex', '0');
      expenseBar.setAttribute('aria-label', `${formatMonthHeading(d.monthStr)} Expense: ${formatCurrency(d.expenses)}`);
      addChartTooltip(expenseBar, `${formatMonthHeading(d.monthStr)}<br>Expense: <strong>${formatCurrency(d.expenses)}</strong>`, containerEl);
      svg.appendChild(expenseBar);

      // Savings Point
      const savingsClamped = Math.max(0, d.savings);
      const savingsY = padding.top + chartH - (savingsClamped / maxVal) * chartH;
      savingsPoints.push({ x: groupX, y: savingsY, savings: d.savings, month: d.monthStr });

      // Month Label on X axis
      const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xLabel.setAttribute('x', groupX);
      xLabel.setAttribute('y', height - 10);
      xLabel.setAttribute('text-anchor', 'middle');
      xLabel.setAttribute('class', 'chart-axis-text');
      xLabel.textContent = formatShortMonth(d.monthStr);
      svg.appendChild(xLabel);
    });

    // Draw Net Savings Line
    if (savingsPoints.length > 1) {
      let pathD = `M ${savingsPoints[0].x} ${savingsPoints[0].y}`;
      for (let i = 1; i < savingsPoints.length; i++) {
        pathD += ` L ${savingsPoints[i].x} ${savingsPoints[i].y}`;
      }

      const savingsLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      savingsLine.setAttribute('d', pathD);
      savingsLine.setAttribute('class', 'chart-line-savings');
      svg.appendChild(savingsLine);
    }

    // Savings Points
    savingsPoints.forEach(pt => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '4.5');
      circle.setAttribute('class', 'chart-point-savings');
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('aria-label', `${formatMonthHeading(pt.month)} Net Savings: ${formatCurrency(pt.savings)}`);
      addChartTooltip(circle, `${formatMonthHeading(pt.month)}<br>Net Savings: <strong>${formatCurrency(pt.savings)}</strong>`, containerEl);
      svg.appendChild(circle);
    });

    containerEl.appendChild(svg);
  }

  /**
   * Render SVG Donut Chart for Expense Categories
   */
  function renderCategoryDonutChart(containerEl, legendEl, monthStr) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    if (legendEl) legendEl.innerHTML = '';

    const { list, totalExpenses } = getCategoryExpenses(monthStr);

    if (totalExpenses === 0 || list.length === 0) {
      containerEl.innerHTML = `
        <div style="text-align: center; color: var(--text-tertiary); font-size: 0.82rem; padding: 20px;">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" stroke-width="1.5" fill="none" style="margin-bottom: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
          <div>No expenses recorded for ${formatMonthHeading(monthStr)}</div>
        </div>
      `;
      if (legendEl) {
        legendEl.innerHTML = '<div style="color: var(--text-tertiary); font-size: 0.8rem; text-align: center; padding: 10px;">No category data available</div>';
      }
      return;
    }

    const size = Math.min(containerEl.clientWidth || 180, containerEl.clientHeight || 180, 180);
    const strokeWidth = 24;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', 'donut-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Expense category breakdown donut chart for ${formatMonthHeading(monthStr)}`);

    // Center Total text
    const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const labelTotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    labelTotal.setAttribute('x', center);
    labelTotal.setAttribute('y', center - 4);
    labelTotal.setAttribute('text-anchor', 'middle');
    labelTotal.setAttribute('fill', 'var(--text-tertiary)');
    labelTotal.setAttribute('font-size', '10px');
    labelTotal.textContent = 'TOTAL';

    const valTotal = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valTotal.setAttribute('x', center);
    valTotal.setAttribute('y', center + 14);
    valTotal.setAttribute('text-anchor', 'middle');
    valTotal.setAttribute('fill', 'var(--text-primary)');
    valTotal.setAttribute('font-weight', '700');
    valTotal.setAttribute('font-size', '12px');
    valTotal.textContent = formatCurrency(totalExpenses).replace(/\.\d{2}/, '');

    textGroup.appendChild(labelTotal);
    textGroup.appendChild(valTotal);

    let offsetAccumulator = 0;

    list.forEach(item => {
      const sliceLength = (item.percentage / 100) * circumference;
      const strokeDashoffset = -offsetAccumulator;
      offsetAccumulator += sliceLength;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', center);
      circle.setAttribute('cy', center);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'transparent');
      circle.setAttribute('stroke', CATEGORY_COLORS[item.category] || '#6B7280');
      circle.setAttribute('stroke-width', strokeWidth);
      circle.setAttribute('stroke-dasharray', `${sliceLength} ${circumference - sliceLength}`);
      circle.setAttribute('stroke-dashoffset', strokeDashoffset);
      circle.setAttribute('transform', `rotate(-90 ${center} ${center})`);
      circle.setAttribute('tabindex', '0');
      circle.setAttribute('aria-label', `${item.category}: ${formatCurrency(item.amountPaise)} (${item.percentage.toFixed(1)}%)`);

      addChartTooltip(circle, `<strong>${item.category}</strong><br>${formatCurrency(item.amountPaise)} (${item.percentage.toFixed(1)}%)`, containerEl);

      svg.appendChild(circle);
    });

    svg.appendChild(textGroup);
    containerEl.appendChild(svg);

    // Build Legend list
    if (legendEl) {
      list.slice(0, 6).forEach(item => {
        const row = document.createElement('div');
        row.className = 'donut-legend-row';

        const label = document.createElement('div');
        label.className = 'donut-legend-label';

        const swatch = document.createElement('span');
        swatch.className = 'donut-swatch';
        swatch.style.backgroundColor = CATEGORY_COLORS[item.category] || '#6B7280';

        const name = document.createElement('span');
        name.textContent = `${CATEGORY_ICONS[item.category] || ''} ${item.category}`;

        label.appendChild(swatch);
        label.appendChild(name);

        const values = document.createElement('div');
        values.className = 'donut-legend-values';

        const amt = document.createElement('span');
        amt.className = 'donut-legend-amount';
        amt.textContent = formatCurrency(item.amountPaise);

        const pct = document.createElement('span');
        pct.className = 'donut-legend-pct';
        pct.textContent = `${item.percentage.toFixed(0)}%`;

        values.appendChild(amt);
        values.appendChild(pct);

        row.appendChild(label);
        row.appendChild(values);
        legendEl.appendChild(row);
      });
    }
  }

  /**
   * Helper to attach interactive hover and focus tooltip to SVG elements
   */
  function addChartTooltip(targetEl, htmlContent, containerEl) {
    let tooltip = containerEl.querySelector('.chart-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      containerEl.appendChild(tooltip);
    }

    function show(e) {
      tooltip.innerHTML = htmlContent;
      const rect = containerEl.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (!clientX && targetEl.getBoundingClientRect) {
        const tRect = targetEl.getBoundingClientRect();
        clientX = tRect.left + tRect.width / 2;
        clientY = tRect.top;
      }

      const x = (clientX || rect.left + rect.width / 2) - rect.left;
      const y = (clientY || rect.top + rect.height / 2) - rect.top;

      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.style.opacity = '1';
    }

    function hide() {
      tooltip.style.opacity = '0';
    }

    targetEl.addEventListener('mouseenter', show);
    targetEl.addEventListener('mousemove', show);
    targetEl.addEventListener('mouseleave', hide);
    targetEl.addEventListener('focus', show);
    targetEl.addEventListener('blur', hide);
  }

  /* ==========================================================================
     9. UI Rendering & Views Engine
     ========================================================================== */

  /**
   * Updates All Views and Synchronizes Display
   */
  function renderAll() {
    updateTopBar();
    renderOverview();
    renderTransactionsTable();
    renderBudgets();
    renderAnalytics();
    renderSettings();
  }

  function updateTopBar() {
    const curDateEl = document.getElementById('current-date-text');
    if (curDateEl) {
      const today = new Date();
      curDateEl.textContent = today.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Demo badge visibility
    const demoBadge = document.getElementById('demo-badge-container');
    if (demoBadge) {
      demoBadge.style.display = state.isDemo ? 'block' : 'none';
    }

    // Nav transactions counter
    const navTxBadge = document.getElementById('nav-tx-badge');
    if (navTxBadge) {
      navTxBadge.textContent = state.transactions.length;
    }

    // Currency symbol labels in modal forms
    const symLabels = document.querySelectorAll('.currency-label-sym');
    const sym = getCurrencySymbol();
    symLabels.forEach(el => {
      el.textContent = sym;
    });
  }

  /**
   * Render Signature Hero Panel Native SVG Sparkline Trajectory
   */
  function renderHeroSparkline(selectedMonth, totalBalance) {
    const svg = document.getElementById('hero-sparkline-svg');
    const healthStatusEl = document.getElementById('hero-financial-health-status');
    if (!svg) return;
    svg.innerHTML = '';

    const months = getMonthList(selectedMonth, 6);
    const data = months.map(m => calculateMonthlyTotals(m));

    if (healthStatusEl) {
      const curData = calculateMonthlyTotals(selectedMonth);
      if (curData.savings > 0) {
        healthStatusEl.textContent = `Capital Accumulating (+${curData.savingsRate}%)`;
        healthStatusEl.style.color = 'var(--primary)';
      } else if (curData.savings < 0) {
        healthStatusEl.textContent = 'Deficit Incurred';
        healthStatusEl.style.color = 'var(--expense)';
      } else {
        healthStatusEl.textContent = 'Neutral Cashflow';
        healthStatusEl.style.color = 'var(--text-secondary)';
      }
    }

    const width = 400;
    const height = 60;
    const padding = 6;

    let minVal = Infinity;
    let maxVal = -Infinity;

    let runningNet = 0;
    const pointsData = data.map(d => {
      runningNet += d.savings;
      if (runningNet < minVal) minVal = runningNet;
      if (runningNet > maxVal) maxVal = runningNet;
      return runningNet;
    });

    if (maxVal === minVal) {
      maxVal += 1000;
      minVal -= 1000;
    }

    const range = maxVal - minVal || 1;
    const points = pointsData.map((val, idx) => {
      const x = padding + (idx / (pointsData.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
      return { x, y };
    });

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="heroSparkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8CF5C6" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#8CF5C6" stop-opacity="0.0" />
      </linearGradient>
    `;
    svg.appendChild(defs);

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const cpX = (current.x + next.x) / 2;
      pathD += ` C ${cpX} ${current.y}, ${cpX} ${next.y}, ${next.x} ${next.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('fill', 'url(#heroSparkGrad)');
    svg.appendChild(areaPath);

    const strokePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    strokePath.setAttribute('d', pathD);
    strokePath.setAttribute('fill', 'none');
    strokePath.setAttribute('stroke', '#8CF5C6');
    strokePath.setAttribute('stroke-width', '2.5');
    strokePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(strokePath);

    const endPt = points[points.length - 1];
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', endPt.x);
    circle.setAttribute('cy', endPt.y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#8CF5C6');
    circle.setAttribute('stroke', '#101820');
    circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);
  }

  /**
   * Render View 1: Overview Dashboard
   */
  function renderOverview() {
    const selectedMonth = state.settings.selectedMonth || getCurrentMonthString();
    const monthInput = document.getElementById('overview-month-input');
    if (monthInput && monthInput.value !== selectedMonth) {
      monthInput.value = selectedMonth;
    }

    // Dynamic greeting
    const welcomeMsg = document.getElementById('welcome-message');
    if (welcomeMsg) {
      const hour = new Date().getHours();
      let greeting = 'Good day';
      if (hour < 12) greeting = 'Good morning';
      else if (hour < 18) greeting = 'Good afternoon';
      else greeting = 'Good evening';
      welcomeMsg.textContent = `${greeting}, Pilot`;
    }

    // 4 Summary Metrics
    const totalBalance = calculateTotalBalance();
    const monthlyTotals = calculateMonthlyTotals(selectedMonth);

    const elBalance = document.getElementById('metric-total-balance');
    if (elBalance) {
      elBalance.textContent = formatCurrency(totalBalance);
      elBalance.className = `metric-value ${totalBalance >= 0 ? '' : 'text-expense'}`;
    }

    const elIncome = document.getElementById('metric-monthly-income');
    if (elIncome) elIncome.textContent = formatCurrency(monthlyTotals.income);

    const elExpenses = document.getElementById('metric-monthly-expenses');
    if (elExpenses) elExpenses.textContent = formatCurrency(monthlyTotals.expenses);

    const elSavings = document.getElementById('metric-monthly-savings');
    if (elSavings) {
      elSavings.textContent = formatCurrency(monthlyTotals.savings);
      elSavings.className = `metric-value ${monthlyTotals.savings >= 0 ? 'text-income' : 'text-expense'}`;
    }

    const elSavingsRate = document.getElementById('metric-savings-rate');
    if (elSavingsRate) {
      elSavingsRate.textContent = `Savings Rate: ${monthlyTotals.savingsRate}%`;
    }

    // Prior Month Comparisons (Strictly derived from real stored transactions)
    const elIncomeComp = document.getElementById('metric-income-comparison');
    if (elIncomeComp) {
      if (!monthlyTotals.priorHasTransactions) {
        elIncomeComp.textContent = 'No prior month recorded';
        elIncomeComp.className = 'comparison-tag';
      } else if (monthlyTotals.priorIncome === 0) {
        elIncomeComp.textContent = monthlyTotals.income > 0 ? '+100% vs prior month' : 'Unchanged vs prior month';
        elIncomeComp.className = 'comparison-tag up';
      } else {
        const diff = monthlyTotals.income - monthlyTotals.priorIncome;
        const pct = Math.round((diff / monthlyTotals.priorIncome) * 100);
        const sign = pct >= 0 ? '+' : '';
        elIncomeComp.textContent = `${sign}${pct}% vs prior month`;
        elIncomeComp.className = `comparison-tag ${pct >= 0 ? 'up' : 'down'}`;
      }
    }

    const elExpenseComp = document.getElementById('metric-expense-comparison');
    if (elExpenseComp) {
      if (!monthlyTotals.priorHasTransactions) {
        elExpenseComp.textContent = 'No prior month recorded';
        elExpenseComp.className = 'comparison-tag';
      } else if (monthlyTotals.priorExpenses === 0) {
        elExpenseComp.textContent = monthlyTotals.expenses > 0 ? '+100% vs prior month' : 'Unchanged vs prior month';
        elExpenseComp.className = 'comparison-tag down';
      } else {
        const diff = monthlyTotals.expenses - monthlyTotals.priorExpenses;
        const pct = Math.round((diff / monthlyTotals.priorExpenses) * 100);
        const sign = pct >= 0 ? '+' : '';
        elExpenseComp.textContent = `${sign}${pct}% vs prior month`;
        // For expenses: lower is better (green/up), higher is worse (red/down)
        elExpenseComp.className = `comparison-tag ${pct <= 0 ? 'up' : 'down'}`;
      }
    }

    // Render Charts & Hero Visualizations
    renderHeroSparkline(selectedMonth, totalBalance);

    const cashFlowContainer = document.getElementById('overview-cashflow-container');
    renderCashFlowChart(cashFlowContainer, state.cashflowPeriod || 6, selectedMonth);

    const donutContainer = document.getElementById('overview-donut-container');
    const donutLegend = document.getElementById('overview-category-legend');
    renderCategoryDonutChart(donutContainer, donutLegend, selectedMonth);

    // Render Overview Budget Highlights (top 3 critical)
    renderOverviewBudgets(selectedMonth);

    // Render Overview Recent Transactions (latest 5)
    renderOverviewRecentTxs();
  }

  function renderOverviewBudgets(selectedMonth) {
    const listEl = document.getElementById('overview-budget-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const budgets = getBudgetsWithActuals(selectedMonth);
    if (budgets.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 16px; color: var(--text-tertiary); font-size: 0.85rem;">
          No category budgets defined.
          <div style="margin-top: 8px;">
            <button class="btn btn-outline btn-sm" data-navigate="budgets">+ Create Budget</button>
          </div>
        </div>
      `;
      return;
    }

    // Sort by percentage utilization descending to highlight critical ones
    budgets.sort((a, b) => b.percentage - a.percentage);
    budgets.slice(0, 3).forEach(b => {
      const item = document.createElement('div');
      item.className = 'overview-budget-item';

      let barClass = 'progress-normal';
      if (b.status === 'danger') barClass = 'progress-danger';
      else if (b.status === 'warning') barClass = 'progress-warning';

      const clampedPct = Math.min(100, Math.round(b.percentage));

      item.innerHTML = `
        <div class="overview-budget-header">
          <span class="budget-cat-name">${CATEGORY_ICONS[b.category] || ''} ${b.category}</span>
          <span class="budget-cat-ratio">${formatCurrency(b.actualSpent)} / ${formatCurrency(b.limitPaise)} (${clampedPct}%)</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${barClass}" style="width: ${clampedPct}%;"></div>
        </div>
      `;
      listEl.appendChild(item);
    });
  }

  function renderOverviewRecentTxs() {
    const listEl = document.getElementById('overview-recent-tx-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (state.transactions.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 16px; color: var(--text-tertiary); font-size: 0.85rem;">
          No transactions recorded yet.
        </div>
      `;
      return;
    }

    // Sort by date descending
    const sorted = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.slice(0, 5).forEach(tx => {
      const item = document.createElement('div');
      item.className = 'recent-tx-item';

      const isInc = tx.type === 'income';
      const icon = CATEGORY_ICONS[tx.category] || '💸';

      const left = document.createElement('div');
      left.className = 'recent-tx-left';

      const iconPill = document.createElement('div');
      iconPill.className = 'category-icon-pill';
      iconPill.textContent = icon;

      const details = document.createElement('div');
      const desc = document.createElement('div');
      desc.className = 'recent-tx-desc';
      desc.textContent = tx.description;

      const meta = document.createElement('div');
      meta.className = 'recent-tx-meta';
      meta.textContent = `${formatDisplayDate(tx.date)} • ${tx.category}`;

      details.appendChild(desc);
      details.appendChild(meta);
      left.appendChild(iconPill);
      left.appendChild(details);

      const right = document.createElement('div');
      right.className = `recent-tx-amount ${isInc ? 'text-income' : 'text-expense'}`;
      right.textContent = `${isInc ? '+' : '-'}${formatCurrency(tx.amountPaise)}`;

      item.appendChild(left);
      item.appendChild(right);
      listEl.appendChild(item);
    });
  }

  /**
   * Render View 2: Transactions Table & Filtering
   */
  function renderTransactionsTable() {
    populateCategoryFilter();

    const tbody = document.getElementById('tx-table-body');
    const emptyState = document.getElementById('tx-empty-state');
    const totalCounter = document.getElementById('tx-total-counter');
    const statusText = document.getElementById('filter-status-text');

    const filtered = getFilteredTransactions();

    if (totalCounter) {
      totalCounter.textContent = `${state.transactions.length} total`;
    }

    // Calculate totals for currently filtered list
    let fIncome = 0;
    let fExpense = 0;
    filtered.forEach(tx => {
      if (tx.type === 'income') fIncome += tx.amountPaise;
      else if (tx.type === 'expense') fExpense += tx.amountPaise;
    });

    const fNet = fIncome - fExpense;

    const elTotInc = document.getElementById('filter-total-income');
    const elTotExp = document.getElementById('filter-total-expense');
    const elTotNet = document.getElementById('filter-total-net');

    if (elTotInc) elTotInc.textContent = formatCurrency(fIncome);
    if (elTotExp) elTotExp.textContent = formatCurrency(fExpense);
    if (elTotNet) {
      elTotNet.textContent = formatCurrency(fNet);
      elTotNet.className = fNet >= 0 ? 'text-income' : 'text-expense';
    }

    if (statusText) {
      statusText.textContent = `Showing ${filtered.length} of ${state.transactions.length} records`;
    }

    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Render table rows safely using DOM nodes to prevent XSS
    filtered.forEach(tx => {
      const tr = document.createElement('tr');

      // 1. Date
      const tdDate = document.createElement('td');
      tdDate.setAttribute('data-label', 'Date');
      tdDate.textContent = formatDisplayDate(tx.date);

      // 2. Category
      const tdCat = document.createElement('td');
      tdCat.setAttribute('data-label', 'Category');
      const badge = document.createElement('span');
      badge.className = 'tx-cat-badge';
      badge.textContent = `${CATEGORY_ICONS[tx.category] || ''} ${tx.category}`;
      tdCat.appendChild(badge);

      // 3. Description & Notes
      const tdDesc = document.createElement('td');
      tdDesc.className = 'th-desc';
      tdDesc.setAttribute('data-label', 'Description');

      const descTitle = document.createElement('strong');
      descTitle.textContent = tx.description;
      tdDesc.appendChild(descTitle);

      if (tx.notes && tx.notes.trim()) {
        const noteEl = document.createElement('div');
        noteEl.style.fontSize = '0.75rem';
        noteEl.style.color = 'var(--text-tertiary)';
        noteEl.style.marginTop = '2px';
        noteEl.textContent = tx.notes;
        tdDesc.appendChild(noteEl);
      }

      // 4. Type
      const tdType = document.createElement('td');
      tdType.setAttribute('data-label', 'Type');
      const typePill = document.createElement('span');
      typePill.className = `tx-type-pill ${tx.type === 'income' ? 'type-pill-income' : 'type-pill-expense'}`;
      typePill.textContent = tx.type;
      tdType.appendChild(typePill);

      // 5. Amount
      const tdAmt = document.createElement('td');
      tdAmt.className = 'th-amount text-right';
      tdAmt.setAttribute('data-label', 'Amount');
      const isInc = tx.type === 'income';
      tdAmt.style.fontWeight = '700';
      tdAmt.className += isInc ? ' text-income' : ' text-expense';
      tdAmt.textContent = `${isInc ? '+' : '-'}${formatCurrency(tx.amountPaise)}`;

      // 6. Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'th-actions text-center';
      tdActions.setAttribute('data-label', 'Actions');

      const actionWrap = document.createElement('div');
      actionWrap.className = 'tx-table-actions';

      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.className = 'action-icon-btn';
      editBtn.setAttribute('title', 'Edit transaction');
      editBtn.setAttribute('aria-label', `Edit transaction: ${tx.description}`);
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
      editBtn.addEventListener('click', () => openEditTxModal(tx.id));

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-icon-btn delete-btn';
      deleteBtn.setAttribute('title', 'Delete transaction');
      deleteBtn.setAttribute('aria-label', `Delete transaction: ${tx.description}`);
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      deleteBtn.addEventListener('click', () => promptDeleteTx(tx.id));

      actionWrap.appendChild(editBtn);
      actionWrap.appendChild(deleteBtn);
      tdActions.appendChild(actionWrap);

      tr.appendChild(tdDate);
      tr.appendChild(tdCat);
      tr.appendChild(tdDesc);
      tr.appendChild(tdType);
      tr.appendChild(tdAmt);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function populateCategoryFilter() {
    const sel = document.getElementById('tx-category-filter');
    if (!sel || sel.children.length > 1) return;

    const optGroupInc = document.createElement('optgroup');
    optGroupInc.label = 'Income Categories';
    CATEGORIES.income.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${CATEGORY_ICONS[cat] || ''} ${cat}`;
      optGroupInc.appendChild(opt);
    });

    const optGroupExp = document.createElement('optgroup');
    optGroupExp.label = 'Expense Categories';
    CATEGORIES.expense.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${CATEGORY_ICONS[cat] || ''} ${cat}`;
      optGroupExp.appendChild(opt);
    });

    sel.appendChild(optGroupInc);
    sel.appendChild(optGroupExp);
  }

  function getFilteredTransactions() {
    let result = [...state.transactions];
    const { search, type, category, dateRange, sort } = state.filters;

    // Search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(tx =>
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.category && tx.category.toLowerCase().includes(q))
      );
    }

    // Type
    if (type !== 'all') {
      result = result.filter(tx => tx.type === type);
    }

    // Category
    if (category !== 'all') {
      result = result.filter(tx => tx.category === category);
    }

    // Date range
    const curMonth = getCurrentMonthString();
    if (dateRange === 'this_month') {
      result = result.filter(tx => tx.date.startsWith(curMonth));
    } else if (dateRange === 'last_month') {
      const lastMonth = getRelativeMonth(curMonth, -1);
      result = result.filter(tx => tx.date.startsWith(lastMonth));
    } else if (dateRange === 'last_3_months') {
      const m1 = curMonth;
      const m2 = getRelativeMonth(curMonth, -1);
      const m3 = getRelativeMonth(curMonth, -2);
      result = result.filter(tx => tx.date.startsWith(m1) || tx.date.startsWith(m2) || tx.date.startsWith(m3));
    } else if (dateRange === 'this_year') {
      const curYear = curMonth.split('-')[0];
      result = result.filter(tx => tx.date.startsWith(curYear));
    }

    // Sorting
    result.sort((a, b) => {
      if (sort === 'date-asc') {
        return new Date(a.date) - new Date(b.date);
      } else if (sort === 'amount-desc') {
        return b.amountPaise - a.amountPaise;
      } else if (sort === 'amount-asc') {
        return a.amountPaise - b.amountPaise;
      }
      // default: date-desc
      return new Date(b.date) - new Date(a.date);
    });

    return result;
  }

  /**
   * Render View 3: Budget Management
   */
  function renderBudgets() {
    const selectedMonth = state.settings.selectedMonth || getCurrentMonthString();
    const monthPill = document.getElementById('budget-month-label');
    if (monthPill) {
      monthPill.textContent = formatMonthHeading(selectedMonth);
    }

    const budgetsWithActuals = getBudgetsWithActuals(selectedMonth);

    // Summary calculation
    let totalBudgeted = 0;
    let totalSpent = 0;

    budgetsWithActuals.forEach(b => {
      totalBudgeted += b.limitPaise;
      totalSpent += b.actualSpent;
    });

    const totalRemaining = totalBudgeted - totalSpent;
    const overallPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

    const elTotal = document.getElementById('budget-stat-total');
    const elSpent = document.getElementById('budget-stat-spent');
    const elRemaining = document.getElementById('budget-stat-remaining');
    const elPct = document.getElementById('budget-stat-pct');
    const elFill = document.getElementById('budget-overall-fill');

    if (elTotal) elTotal.textContent = formatCurrency(totalBudgeted);
    if (elSpent) elSpent.textContent = formatCurrency(totalSpent);
    if (elRemaining) {
      elRemaining.textContent = formatCurrency(totalRemaining);
      elRemaining.className = `stat-value ${totalRemaining >= 0 ? 'text-income' : 'text-expense'}`;
    }
    if (elPct) elPct.textContent = `${overallPct}%`;

    if (elFill) {
      elFill.style.width = `${Math.min(100, overallPct)}%`;
      elFill.className = 'progress-bar-fill';
      if (overallPct >= 100) elFill.classList.add('progress-danger');
      else if (overallPct >= 80) elFill.classList.add('progress-warning');
      else elFill.classList.add('progress-normal');
    }

    const grid = document.getElementById('budgets-grid');
    const emptyState = document.getElementById('budgets-empty-state');
    if (!grid) return;
    grid.innerHTML = '';

    if (budgetsWithActuals.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    budgetsWithActuals.forEach(b => {
      const card = document.createElement('div');
      card.className = 'budget-card';

      let pillClass = 'budget-pill-normal';
      let pillText = 'On Track';
      let barClass = 'progress-normal';

      if (b.status === 'danger') {
        pillClass = 'budget-pill-danger';
        const overAmt = b.actualSpent - b.limitPaise;
        pillText = `Over by ${formatCurrency(overAmt)}`;
        barClass = 'progress-danger';
      } else if (b.status === 'warning') {
        pillClass = 'budget-pill-warning';
        pillText = `Approaching Limit (${Math.round(b.percentage)}%)`;
        barClass = 'progress-warning';
      }

      const clampedPct = Math.min(100, Math.round(b.percentage));

      card.innerHTML = `
        <div class="budget-card-header">
          <div class="budget-card-title-group">
            <span style="font-size: 1.25rem;">${CATEGORY_ICONS[b.category] || '🎯'}</span>
            <span class="budget-card-title">${b.category}</span>
          </div>
          <span class="budget-status-pill ${pillClass}">${pillText}</span>
        </div>

        <div class="budget-numbers-row">
          <div>
            <span class="budget-spent-val">${formatCurrency(b.actualSpent)}</span>
            <span class="budget-limit-val">of ${formatCurrency(b.limitPaise)}</span>
          </div>
          <span style="font-weight: 600; font-family: var(--font-mono);">${clampedPct}%</span>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${barClass}" style="width: ${clampedPct}%;"></div>
        </div>

        <div class="budget-footer">
          <span>Remaining: <strong class="${b.remaining >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(b.remaining)}</strong></span>
          <div style="display: flex; gap: 4px;">
            <button class="action-icon-btn edit-budget-btn" aria-label="Edit budget for ${b.category}" title="Edit Budget">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete-btn delete-budget-btn" aria-label="Remove budget for ${b.category}" title="Remove Budget">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;

      const editBtn = card.querySelector('.edit-budget-btn');
      if (editBtn) editBtn.addEventListener('click', () => openEditBudgetModal(b.id));

      const delBtn = card.querySelector('.delete-budget-btn');
      if (delBtn) delBtn.addEventListener('click', () => promptDeleteBudget(b.id));

      grid.appendChild(card);
    });
  }

  /**
   * Render View 4: Analytics
   */
  function renderAnalytics() {
    const selectedMonth = state.settings.selectedMonth || getCurrentMonthString();
    const range = state.analyticsRange || 6;

    // Detailed Cash Flow Chart
    const cashFlowContainer = document.getElementById('analytics-cashflow-container');
    renderCashFlowChart(cashFlowContainer, range, selectedMonth);

    // Expense Distribution Donut & Legend
    const donutContainer = document.getElementById('analytics-donut-container');
    const donutLegend = document.getElementById('analytics-category-legend');
    renderCategoryDonutChart(donutContainer, donutLegend, selectedMonth);

    // Render Data Table for screen readers / accessibility
    renderCashFlowSummaryTable(range, selectedMonth);

    // Render Budget vs Actual bars
    renderAnalyticsBudgetBars(selectedMonth);
  }

  function renderCashFlowSummaryTable(monthsCount, targetMonth) {
    const tbody = document.getElementById('cashflow-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const months = getMonthList(targetMonth, monthsCount);
    months.forEach(m => {
      const data = calculateMonthlyTotals(m);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${formatMonthHeading(data.monthStr)}</strong></td>
        <td class="text-income">${formatCurrency(data.income)}</td>
        <td class="text-expense">${formatCurrency(data.expenses)}</td>
        <td class="${data.savings >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(data.savings)}</td>
        <td>${data.savingsRate}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderAnalyticsBudgetBars(selectedMonth) {
    const container = document.getElementById('analytics-budget-bars');
    if (!container) return;
    container.innerHTML = '';

    const budgets = getBudgetsWithActuals(selectedMonth);
    if (budgets.length === 0) {
      container.innerHTML = '<div style="color: var(--text-tertiary); font-size: 0.85rem; padding: 20px; text-align: center;">No active budgets for comparison</div>';
      return;
    }

    budgets.forEach(b => {
      const item = document.createElement('div');
      item.className = 'analytics-budget-bar-item';

      let barClass = 'progress-normal';
      if (b.status === 'danger') barClass = 'progress-danger';
      else if (b.status === 'warning') barClass = 'progress-warning';

      const pct = Math.min(100, Math.round(b.percentage));

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; font-weight: 600;">
          <span>${CATEGORY_ICONS[b.category] || ''} ${b.category}</span>
          <span style="font-family: var(--font-mono);">${formatCurrency(b.actualSpent)} / ${formatCurrency(b.limitPaise)}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill ${barClass}" style="width: ${pct}%;"></div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Render View 5: Settings
   */
  function renderSettings() {
    const currSelect = document.getElementById('currency-select');
    if (currSelect) currSelect.value = state.settings.currency;

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = state.settings.theme;

    const defaultMonthSelect = document.getElementById('default-month-select');
    if (defaultMonthSelect) defaultMonthSelect.value = state.settings.defaultMonth;
  }

  /* ==========================================================================
     10. Transaction CRUD Operations
     ========================================================================== */
  function addTransaction(data) {
    const newTx = {
      id: generateId('tx'),
      description: data.description.trim(),
      amountPaise: toPaise(data.amount),
      type: data.type,
      category: data.category,
      date: data.date,
      notes: data.notes ? data.notes.trim() : ''
    };

    if (!isValidTransaction(newTx)) {
      showToast('Invalid transaction data', 'error');
      return false;
    }

    state.transactions.unshift(newTx);
    state.isDemo = false; // User has performed custom modifications
    saveTransactions();
    renderAll();
    showToast('Transaction added successfully', 'success');
    return true;
  }

  function updateTransaction(id, data) {
    const index = state.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      showToast('Transaction not found', 'error');
      return false;
    }

    const updatedTx = {
      ...state.transactions[index],
      description: data.description.trim(),
      amountPaise: toPaise(data.amount),
      type: data.type,
      category: data.category,
      date: data.date,
      notes: data.notes ? data.notes.trim() : ''
    };

    if (!isValidTransaction(updatedTx)) {
      showToast('Invalid transaction updates', 'error');
      return false;
    }

    state.transactions[index] = updatedTx;
    state.isDemo = false;
    saveTransactions();
    renderAll();
    showToast('Transaction updated successfully', 'success');
    return true;
  }

  function deleteTransaction(id) {
    const initialLen = state.transactions.length;
    state.transactions = state.transactions.filter(t => t.id !== id);
    if (state.transactions.length < initialLen) {
      state.isDemo = false;
      saveTransactions();
      renderAll();
      showToast('Transaction deleted', 'info');
      return true;
    }
    return false;
  }

  /* ==========================================================================
     11. Budget CRUD Operations
     ========================================================================== */
  function saveBudget(category, limitAmount, editId = null) {
    const limitPaise = toPaise(limitAmount);
    if (limitPaise <= 0) {
      showToast('Budget limit must be greater than zero', 'error');
      return false;
    }

    if (editId) {
      const idx = state.budgets.findIndex(b => b.id === editId);
      if (idx !== -1) {
        state.budgets[idx].category = category;
        state.budgets[idx].limitPaise = limitPaise;
      }
    } else {
      // Check if category already has a budget
      const existing = state.budgets.find(b => b.category === category);
      if (existing) {
        existing.limitPaise = limitPaise;
      } else {
        state.budgets.push({
          id: generateId('b'),
          category,
          limitPaise
        });
      }
    }

    state.isDemo = false;
    saveBudgets();
    renderAll();
    showToast('Budget saved successfully', 'success');
    return true;
  }

  function deleteBudget(id) {
    state.budgets = state.budgets.filter(b => b.id !== id);
    state.isDemo = false;
    saveBudgets();
    renderAll();
    showToast('Budget removed', 'info');
  }

  /* ==========================================================================
     12. CSV Export & Import Engine
     ========================================================================== */
  function exportTransactionsToCSV() {
    if (state.transactions.length === 0) {
      showToast('No transactions to export', 'info');
      return;
    }

    const headers = ['ID', 'Date', 'Type', 'Category', 'Description', 'Amount', 'Currency', 'Notes'];
    const rows = state.transactions.map(tx => [
      escapeCSV(tx.id),
      escapeCSV(tx.date),
      escapeCSV(tx.type),
      escapeCSV(tx.category),
      escapeCSV(tx.description),
      escapeCSV(fromPaise(tx.amountPaise).toFixed(2)),
      escapeCSV(state.settings.currency),
      escapeCSV(tx.notes || '')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const curDate = getCurrentDateString();
    link.setAttribute('href', url);
    link.setAttribute('download', `finpilot_transactions_${curDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('CSV export downloaded', 'success');
  }

  function escapeCSV(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function parseCSV(text) {
    const lines = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          cell += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(cell.trim());
        if (row.some(c => c !== '')) {
          lines.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    if (cell || row.length > 0) {
      row.push(cell.trim());
      if (row.some(c => c !== '')) {
        lines.push(row);
      }
    }

    return lines;
  }

  function validateAndProcessCSVRows(rawRows) {
    if (rawRows.length < 2) {
      return { valid: false, error: 'CSV file is empty or missing data rows' };
    }

    const headers = rawRows[0].map(h => h.toLowerCase());
    const dateIdx = headers.findIndex(h => h.includes('date'));
    const typeIdx = headers.findIndex(h => h.includes('type'));
    const catIdx = headers.findIndex(h => h.includes('cat'));
    const descIdx = headers.findIndex(h => h.includes('desc'));
    const amtIdx = headers.findIndex(h => h.includes('amount'));
    const notesIdx = headers.findIndex(h => h.includes('note'));

    if (dateIdx === -1 || typeIdx === -1 || catIdx === -1 || descIdx === -1 || amtIdx === -1) {
      return {
        valid: false,
        error: 'Missing required columns in CSV (Date, Type, Category, Description, Amount)'
      };
    }

    const parsedTxs = [];
    const invalidRows = [];

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      const date = row[dateIdx] || '';
      const type = (row[typeIdx] || '').toLowerCase();
      const category = row[catIdx] || '';
      const description = row[descIdx] || '';
      const amountStr = row[amtIdx] ? row[amtIdx].replace(/[^0-9.]/g, '') : '';
      const amount = parseFloat(amountStr);
      const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx] : '';

      const isDateValid = /^\d{4}-\d{2}-\d{2}$/.test(date);
      const isTypeValid = type === 'income' || type === 'expense';
      const isCatValid = category.length > 0;
      const isDescValid = description.length > 0;
      const isAmtValid = !isNaN(amount) && amount > 0;

      if (isDateValid && isTypeValid && isCatValid && isDescValid && isAmtValid) {
        parsedTxs.push({
          id: generateId('tx_imp'),
          date,
          type,
          category,
          description,
          amountPaise: toPaise(amount),
          notes
        });
      } else {
        invalidRows.push({ rowNumber: r + 1, data: row });
      }
    }

    return {
      valid: true,
      parsedTxs,
      invalidRows,
      totalRows: rawRows.length - 1
    };
  }

  /* ==========================================================================
     13. Modal Controller & Dialog Focus Management
     ========================================================================== */
  const ModalController = {
    activeModal: null,
    previousFocusedElement: null,

    open(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      this.previousFocusedElement = document.activeElement;
      this.activeModal = modal;

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      // Trap focus: focus first interactive element
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length > 0) {
        setTimeout(() => focusable[0].focus(), 50);
      }
    },

    close() {
      if (!this.activeModal) return;

      this.activeModal.classList.remove('open');
      this.activeModal.setAttribute('aria-hidden', 'true');

      if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === 'function') {
        this.previousFocusedElement.focus();
      }

      this.activeModal = null;
    }
  };

  /* Modal Form Openers */
  function openAddTxModal() {
    const form = document.getElementById('tx-form');
    if (!form) return;
    form.reset();

    document.getElementById('tx-edit-id').value = '';
    document.getElementById('tx-modal-title').textContent = 'Add Transaction';
    document.getElementById('tx-date').value = getCurrentDateString();

    // Default to Expense
    setTxModalType('expense');

    clearTxFormErrors();
    ModalController.open('tx-modal');
  }

  function openEditTxModal(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    const form = document.getElementById('tx-form');
    if (!form) return;
    form.reset();

    document.getElementById('tx-edit-id').value = tx.id;
    document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
    document.getElementById('tx-description').value = tx.description;
    document.getElementById('tx-amount').value = fromPaise(tx.amountPaise).toFixed(2);
    document.getElementById('tx-date').value = tx.date;
    document.getElementById('tx-notes').value = tx.notes || '';

    setTxModalType(tx.type);
    document.getElementById('tx-category').value = tx.category;

    clearTxFormErrors();
    ModalController.open('tx-modal');
  }

  function setTxModalType(type) {
    const typeButtons = document.querySelectorAll('.type-btn');
    typeButtons.forEach(btn => {
      const isMatch = btn.getAttribute('data-type') === type;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    const categorySelect = document.getElementById('tx-category');
    if (!categorySelect) return;
    categorySelect.innerHTML = '';

    const list = CATEGORIES[type] || [];
    list.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${CATEGORY_ICONS[cat] || ''} ${cat}`;
      categorySelect.appendChild(opt);
    });
  }

  function clearTxFormErrors() {
    ['tx-desc-error', 'tx-amount-error', 'tx-category-error', 'tx-date-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function promptDeleteTx(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    state.pendingTxId = id;
    const preview = document.getElementById('delete-tx-preview');
    if (preview) {
      preview.textContent = `${tx.description} — ${formatCurrency(tx.amountPaise)} (${formatDisplayDate(tx.date)})`;
    }

    ModalController.open('delete-tx-modal');
  }

  function openAddBudgetModal() {
    const form = document.getElementById('budget-form');
    if (!form) return;
    form.reset();

    document.getElementById('budget-edit-id').value = '';
    document.getElementById('budget-modal-title').textContent = 'Set Category Budget';

    populateBudgetCategorySelect();
    clearBudgetFormErrors();
    ModalController.open('budget-modal');
  }

  function openEditBudgetModal(id) {
    const budget = state.budgets.find(b => b.id === id);
    if (!budget) return;

    const form = document.getElementById('budget-form');
    if (!form) return;
    form.reset();

    document.getElementById('budget-edit-id').value = budget.id;
    document.getElementById('budget-modal-title').textContent = 'Edit Category Budget';

    populateBudgetCategorySelect();
    document.getElementById('budget-category').value = budget.category;
    document.getElementById('budget-limit').value = fromPaise(budget.limitPaise).toFixed(0);

    clearBudgetFormErrors();
    ModalController.open('budget-modal');
  }

  function populateBudgetCategorySelect() {
    const sel = document.getElementById('budget-category');
    if (!sel) return;
    sel.innerHTML = '';

    CATEGORIES.expense.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${CATEGORY_ICONS[cat] || ''} ${cat}`;
      sel.appendChild(opt);
    });
  }

  function clearBudgetFormErrors() {
    ['budget-cat-error', 'budget-limit-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
  }

  function promptDeleteBudget(id) {
    const budget = state.budgets.find(b => b.id === id);
    if (!budget) return;

    state.pendingBudgetId = id;
    const catNameEl = document.getElementById('delete-budget-cat-name');
    if (catNameEl) {
      catNameEl.textContent = budget.category;
    }

    ModalController.open('delete-budget-modal');
  }

  function promptAction(title, message, warning, actionCallback) {
    state.pendingAction = actionCallback;

    document.getElementById('confirm-action-title').textContent = title;
    document.getElementById('confirm-action-message').textContent = message;
    document.getElementById('confirm-action-warning').textContent = warning;

    ModalController.open('confirm-action-modal');
  }

  /* ==========================================================================
     14. Toast Notification Service
     ========================================================================== */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#16A36A" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#D9443B" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="#3B82F6" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <span>${iconSvg}</span>
      <span style="flex: 1;">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeToastOut 200ms ease forwards';
      setTimeout(() => {
        if (toast.parentElement) toast.parentElement.removeChild(toast);
      }, 200);
    }, duration);
  }

  /* ==========================================================================
     15. View Navigation & Routing
     ========================================================================== */
  function switchView(viewName) {
    const views = document.querySelectorAll('.app-view');
    let targetView = document.getElementById(`view-${viewName}`);
    if (!targetView) {
      viewName = 'overview';
      targetView = document.getElementById('view-overview');
    }

    views.forEach(v => v.classList.remove('active'));
    targetView.classList.add('active');

    // Update Sidebar Navigation state
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const isTarget = item.getAttribute('data-view') === viewName;
      item.classList.toggle('active', isTarget);
      if (isTarget) {
        item.setAttribute('aria-current', 'page');
      } else {
        item.removeAttribute('aria-current');
      }
    });

    // Update Header Title and Subtitle
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');

    const headers = {
      overview: { title: 'Overview', sub: 'Personal financial performance and summary' },
      transactions: { title: 'Transactions', sub: 'Comprehensive record of income and expenses' },
      budgets: { title: 'Budgets', sub: 'Category spending targets and limit monitoring' },
      analytics: { title: 'Analytics', sub: 'Cash flow patterns, trends, and category distribution' },
      settings: { title: 'Settings', sub: 'Preferences, currency configurations, and data controls' }
    };

    if (titleEl && headers[viewName]) titleEl.textContent = headers[viewName].title;
    if (subtitleEl && headers[viewName]) subtitleEl.textContent = headers[viewName].sub;

    state.activeView = viewName;
    window.location.hash = viewName;

    // Close mobile drawer if open
    closeMobileDrawer();

    // Re-render target view
    if (viewName === 'overview') renderOverview();
    else if (viewName === 'transactions') renderTransactionsTable();
    else if (viewName === 'budgets') renderBudgets();
    else if (viewName === 'analytics') renderAnalytics();
    else if (viewName === 'settings') renderSettings();
  }

  function openMobileDrawer() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('drawer-overlay');
    if (sidebar) sidebar.classList.add('drawer-open');
    if (overlay) overlay.classList.add('active');
  }

  function closeMobileDrawer() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('drawer-overlay');
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (overlay) overlay.classList.remove('active');
  }

  function setTheme(theme) {
    state.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    if (lightIcon && darkIcon) {
      if (theme === 'dark') {
        lightIcon.style.display = 'none';
        darkIcon.style.display = 'block';
      } else {
        lightIcon.style.display = 'block';
        darkIcon.style.display = 'none';
      }
    }

    saveSettings();
    // Re-render charts to adjust text and stroke colors
    renderOverview();
    renderAnalytics();
  }

  function toggleTheme() {
    const newTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }

  /* ==========================================================================
     16. Event Listeners & Binding
     ========================================================================== */
  function setupEventListeners() {
    // 1. Navigation items click
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        switchView(view);
      });
    });

    // 2. Hash routing on window load / hashchange
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['overview', 'transactions', 'budgets', 'analytics', 'settings'].includes(hash)) {
        if (state.activeView !== hash) switchView(hash);
      }
    });

    // 3. In-page data-navigate links
    document.addEventListener('click', e => {
      const navTarget = e.target.closest('[data-navigate]');
      if (navTarget) {
        const view = navTarget.getAttribute('data-navigate');
        switchView(view);
      }
    });

    // 4. Mobile drawer open/close
    const menuBtn = document.getElementById('mobile-menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', openMobileDrawer);

    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeMobileDrawer);

    const overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.addEventListener('click', closeMobileDrawer);

    // 5. Theme toggle buttons
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', e => {
        setTheme(e.target.value);
      });
    }

    // 6. Currency selector in Settings
    const currSelect = document.getElementById('currency-select');
    if (currSelect) {
      currSelect.addEventListener('change', e => {
        state.settings.currency = e.target.value;
        saveSettings();
        renderAll();
        showToast(`Currency changed to ${state.settings.currency}`, 'success');
      });
    }

    // 7. Default month select in Settings
    const defMonthSelect = document.getElementById('default-month-select');
    if (defMonthSelect) {
      defMonthSelect.addEventListener('change', e => {
        state.settings.defaultMonth = e.target.value;
        saveSettings();
      });
    }

    // 8. Add Transaction triggers
    const triggerAddTxBtns = [
      'sidebar-add-tx-btn',
      'header-add-tx-btn',
      'add-tx-main-btn',
      'empty-add-tx-btn',
      'hero-quick-tx-btn'
    ];
    triggerAddTxBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', openAddTxModal);
    });

    // 9. Transaction Modal Type selector toggle
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        setTxModalType(type);
      });
    });

    // 10. Transaction Form Submit
    const txForm = document.getElementById('tx-form');
    if (txForm) {
      txForm.addEventListener('submit', handleTxFormSubmit);
    }

    // 11. Modal Close Buttons & Backdrop click
    document.querySelectorAll('.modal-close-btn, #cancel-tx-btn, #cancel-delete-tx-btn, #cancel-budget-btn, #cancel-delete-budget-btn, #cancel-import-csv-btn, #cancel-action-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => ModalController.close());
      });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          ModalController.close();
        }
      });
    });

    // Escape key closes open dialog
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ModalController.activeModal) {
        ModalController.close();
      }
    });

    // 12. Delete Transaction confirmation
    const confirmDeleteTxBtn = document.getElementById('confirm-delete-tx-btn');
    if (confirmDeleteTxBtn) {
      confirmDeleteTxBtn.addEventListener('click', () => {
        if (state.pendingTxId) {
          deleteTransaction(state.pendingTxId);
          state.pendingTxId = null;
          ModalController.close();
        }
      });
    }

    // 13. Month selector on Overview
    const monthInput = document.getElementById('overview-month-input');
    if (monthInput) {
      monthInput.addEventListener('change', e => {
        state.settings.selectedMonth = e.target.value;
        saveSettings();
        renderOverview();
        renderBudgets();
        renderAnalytics();
      });
    }

    const prevMonthBtn = document.getElementById('month-prev-btn');
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        const cur = state.settings.selectedMonth || getCurrentMonthString();
        state.settings.selectedMonth = getRelativeMonth(cur, -1);
        saveSettings();
        renderOverview();
        renderBudgets();
        renderAnalytics();
      });
    }

    const nextMonthBtn = document.getElementById('month-next-btn');
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        const cur = state.settings.selectedMonth || getCurrentMonthString();
        state.settings.selectedMonth = getRelativeMonth(cur, 1);
        saveSettings();
        renderOverview();
        renderBudgets();
        renderAnalytics();
      });
    }

    const curMonthBtn = document.getElementById('month-current-btn');
    if (curMonthBtn) {
      curMonthBtn.addEventListener('click', () => {
        state.settings.selectedMonth = getCurrentMonthString();
        saveSettings();
        renderOverview();
        renderBudgets();
        renderAnalytics();
      });
    }

    // 14. Overview Cashflow Period Radios (6M vs 12M)
    document.querySelectorAll('.chart-period-selector .period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.chart-period-selector .period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.cashflowPeriod = parseInt(btn.getAttribute('data-period'), 10) || 6;
        const container = document.getElementById('overview-cashflow-container');
        renderCashFlowChart(container, state.cashflowPeriod, state.settings.selectedMonth);
      });
    });

    // 15. View All Categories button
    const viewAllCatsBtn = document.getElementById('view-all-categories-btn');
    if (viewAllCatsBtn) {
      viewAllCatsBtn.addEventListener('click', () => switchView('budgets'));
    }

    // 16. Transactions Filter Controls
    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        state.filters.search = e.target.value;
        renderTransactionsTable();
      });
    }

    const typeFilter = document.getElementById('tx-type-filter');
    if (typeFilter) {
      typeFilter.addEventListener('change', e => {
        state.filters.type = e.target.value;
        renderTransactionsTable();
      });
    }

    const catFilter = document.getElementById('tx-category-filter');
    if (catFilter) {
      catFilter.addEventListener('change', e => {
        state.filters.category = e.target.value;
        renderTransactionsTable();
      });
    }

    const dateFilter = document.getElementById('tx-date-filter');
    if (dateFilter) {
      dateFilter.addEventListener('change', e => {
        state.filters.dateRange = e.target.value;
        renderTransactionsTable();
      });
    }

    const sortSelect = document.getElementById('tx-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', e => {
        state.filters.sort = e.target.value;
        renderTransactionsTable();
      });
    }

    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener('click', () => {
        state.filters = {
          search: '',
          type: 'all',
          category: 'all',
          dateRange: 'all',
          sort: 'date-desc'
        };
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (catFilter) catFilter.value = 'all';
        if (dateFilter) dateFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'date-desc';
        renderTransactionsTable();
      });
    }

    // 17. Budget Actions
    const addBudgetBtns = ['add-budget-btn', 'empty-add-budget-btn'];
    addBudgetBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', openAddBudgetModal);
    });

    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
      budgetForm.addEventListener('submit', handleBudgetFormSubmit);
    }

    const confirmDeleteBudgetBtn = document.getElementById('confirm-delete-budget-btn');
    if (confirmDeleteBudgetBtn) {
      confirmDeleteBudgetBtn.addEventListener('click', () => {
        if (state.pendingBudgetId) {
          deleteBudget(state.pendingBudgetId);
          state.pendingBudgetId = null;
          ModalController.close();
        }
      });
    }

    // 18. Analytics Range Buttons (3M / 6M / 12M)
    document.querySelectorAll('.analytics-range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.analytics-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.analyticsRange = parseInt(btn.getAttribute('data-range'), 10) || 6;
        renderAnalytics();
      });
    });

    const toggleTableBtn = document.getElementById('toggle-cashflow-table-btn');
    if (toggleTableBtn) {
      toggleTableBtn.addEventListener('click', () => {
        const tableContainer = document.getElementById('cashflow-data-table-container');
        if (tableContainer) {
          const isHidden = tableContainer.style.display === 'none';
          tableContainer.style.display = isHidden ? 'block' : 'none';
          toggleTableBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
          toggleTableBtn.textContent = isHidden ? 'Hide Data Table' : 'View Data Table';
        }
      });
    }

    // 19. Export & Import CSV
    const exportBtns = ['export-tx-btn', 'settings-export-csv-btn'];
    exportBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', exportTransactionsToCSV);
    });

    const importBtns = ['import-tx-btn', 'settings-import-csv-btn'];
    importBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', openCSVImportModal);
    });

    setupCSVImportListeners();

    // 20. Data Reset & Wipe buttons
    const resetDemoBtn = document.getElementById('settings-reset-demo-btn');
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener('click', () => {
        promptAction(
          'Restore Demonstration Dataset',
          'This will overwrite your current transactions and category budgets with realistic demonstration data.',
          'Your existing transactions will be replaced. Consider exporting your data to CSV first.',
          () => {
            populateInitialDemoData();
            renderAll();
            showToast('Demo dataset restored', 'success');
          }
        );
      });
    }

    const wipeDataBtn = document.getElementById('settings-wipe-data-btn');
    if (wipeDataBtn) {
      wipeDataBtn.addEventListener('click', () => {
        promptAction(
          'Erase All Data',
          'Are you sure you want to permanently erase all stored transactions and budgets?',
          'This action cannot be undone. All locally stored records will be wiped completely.',
          () => {
            state.transactions = [];
            state.budgets = [];
            state.isDemo = false;
            saveTransactions();
            saveBudgets();
            renderAll();
            showToast('All stored records cleared', 'info');
          }
        );
      });
    }

    const proceedActionBtn = document.getElementById('proceed-action-btn');
    if (proceedActionBtn) {
      proceedActionBtn.addEventListener('click', () => {
        if (typeof state.pendingAction === 'function') {
          state.pendingAction();
          state.pendingAction = null;
        }
        ModalController.close();
      });
    }

    // Window resize handler to redraw charts proportionally
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderOverview();
        renderAnalytics();
      }, 150);
    });
  }

  /* Form Validation & Submit Handlers */
  function handleTxFormSubmit(e) {
    e.preventDefault();
    clearTxFormErrors();

    const editId = document.getElementById('tx-edit-id').value;
    const descInput = document.getElementById('tx-description');
    const amountInput = document.getElementById('tx-amount');
    const categorySelect = document.getElementById('tx-category');
    const dateInput = document.getElementById('tx-date');
    const notesInput = document.getElementById('tx-notes');

    const activeTypeBtn = document.querySelector('.type-btn.active');
    const type = activeTypeBtn ? activeTypeBtn.getAttribute('data-type') : 'expense';

    let hasError = false;

    const desc = descInput.value.trim();
    if (!desc) {
      document.getElementById('tx-desc-error').textContent = 'Please enter a description';
      hasError = true;
    }

    const amt = parseFloat(amountInput.value);
    if (isNaN(amt) || amt <= 0) {
      document.getElementById('tx-amount-error').textContent = 'Please enter a valid amount greater than 0';
      hasError = true;
    }

    const category = categorySelect.value;
    if (!category) {
      document.getElementById('tx-category-error').textContent = 'Please select a category';
      hasError = true;
    }

    const date = dateInput.value;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      document.getElementById('tx-date-error').textContent = 'Please select a valid date';
      hasError = true;
    }

    if (hasError) return;

    const payload = {
      description: desc,
      amount: amt,
      type,
      category,
      date,
      notes: notesInput.value
    };

    let success = false;
    if (editId) {
      success = updateTransaction(editId, payload);
    } else {
      success = addTransaction(payload);
    }

    if (success) {
      ModalController.close();
    }
  }

  function handleBudgetFormSubmit(e) {
    e.preventDefault();
    clearBudgetFormErrors();

    const editId = document.getElementById('budget-edit-id').value;
    const catSelect = document.getElementById('budget-category');
    const limitInput = document.getElementById('budget-limit');

    let hasError = false;
    const category = catSelect.value;
    if (!category) {
      document.getElementById('budget-cat-error').textContent = 'Please choose a category';
      hasError = true;
    }

    const limit = parseFloat(limitInput.value);
    if (isNaN(limit) || limit <= 0) {
      document.getElementById('budget-limit-error').textContent = 'Please enter a limit greater than 0';
      hasError = true;
    }

    if (hasError) return;

    const success = saveBudget(category, limit, editId);
    if (success) {
      ModalController.close();
    }
  }

  /* CSV Import Handlers */
  function openCSVImportModal() {
    const fileInput = document.getElementById('csv-file-input');
    if (fileInput) fileInput.value = '';

    const previewSection = document.getElementById('import-preview-section');
    if (previewSection) previewSection.style.display = 'none';

    const confirmBtn = document.getElementById('confirm-import-csv-btn');
    if (confirmBtn) confirmBtn.disabled = true;

    state.pendingImportData = null;
    ModalController.open('import-csv-modal');
  }

  function setupCSVImportListeners() {
    const dropZone = document.getElementById('csv-drop-zone');
    const fileInput = document.getElementById('csv-file-input');
    const confirmBtn = document.getElementById('confirm-import-csv-btn');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleCSVFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        handleCSVFile(fileInput.files[0]);
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!state.pendingImportData || state.pendingImportData.length === 0) return;

        const modeRadio = document.querySelector('input[name="import-mode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'append';

        if (mode === 'replace') {
          state.transactions = state.pendingImportData;
        } else {
          state.transactions = [...state.pendingImportData, ...state.transactions];
        }

        state.isDemo = false;
        saveTransactions();
        renderAll();
        ModalController.close();
        showToast(`Successfully imported ${state.pendingImportData.length} transactions`, 'success');
      });
    }
  }

  function handleCSVFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      showToast('Please select a valid CSV file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const text = e.target.result;
      const parsedRows = parseCSV(text);
      const validation = validateAndProcessCSVRows(parsedRows);

      if (!validation.valid) {
        showToast(validation.error || 'Failed to parse CSV', 'error');
        return;
      }

      state.pendingImportData = validation.parsedTxs;

      const previewSection = document.getElementById('import-preview-section');
      const statsSummary = document.getElementById('import-stats-summary');
      const tbody = document.getElementById('csv-preview-tbody');
      const confirmBtn = document.getElementById('confirm-import-csv-btn');

      if (statsSummary) {
        statsSummary.innerHTML = `
          <strong>Found ${validation.totalRows} row(s):</strong>
          <span class="text-income">${validation.parsedTxs.length} valid</span>,
          <span class="text-expense">${validation.invalidRows.length} invalid/skipped</span>
        `;
      }

      if (tbody) {
        tbody.innerHTML = '';
        validation.parsedTxs.slice(0, 10).forEach(tx => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${tx.date}</td>
            <td>${tx.type}</td>
            <td>${tx.category}</td>
            <td>${tx.description}</td>
            <td>${formatCurrency(tx.amountPaise)}</td>
            <td><span class="text-income">Valid</span></td>
          `;
          tbody.appendChild(tr);
        });
      }

      if (previewSection) previewSection.style.display = 'block';
      if (confirmBtn) confirmBtn.disabled = validation.parsedTxs.length === 0;
    };

    reader.onerror = function () {
      showToast('Error reading the CSV file', 'error');
    };

    reader.readAsText(file);
  }

  /* ==========================================================================
     17. Application Initialization
     ========================================================================== */
  function init() {
    loadFromStorage();

    // Apply stored theme
    setTheme(state.settings.theme || 'light');

    // Attach all interactive event handlers
    setupEventListeners();

    // Check initial hash route
    const hash = window.location.hash.replace('#', '');
    if (hash && ['overview', 'transactions', 'budgets', 'analytics', 'settings'].includes(hash)) {
      switchView(hash);
    } else {
      switchView('overview');
    }

    // Render full application
    renderAll();
  }

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export FinPilot test hook for automated verification in Node / Headless tests
  if (typeof window !== 'undefined') {
    window.FinPilot = {
      state,
      toPaise,
      fromPaise,
      formatCurrency,
      calculateTotalBalance,
      calculateMonthlyTotals,
      getBudgetsWithActuals,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      saveBudget,
      deleteBudget,
      parseCSV,
      validateAndProcessCSVRows,
      renderAll
    };
  }
})();
