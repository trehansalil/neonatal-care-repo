/**
 * Dashboard Component
 * Handles chart visualization, statistics, and trend analysis
 *
 * Features:
 * - Multi-metric charting with Chart.js
 * - Today's stats cards (feeds, diapers, temp, weight)
 * - Aggregation modes (hour, day, week, month)
 * - Metric comparison support
 * - Cumulative toggle for progressive totals
 * - Time range selection (presets + custom)
 * - Responsive chart updates on data/filter changes
 */

import { state } from '../core/state.js';
import { METRICS, STORAGE_KEYS, API_BASE_URL } from '../config.js';
import { getEntryItemType } from '../utils/entry-utils.js';
import { showToast } from '../utils/toast.js';

// Module state
let trendChart = null;
let trendRange = { start: null, end: null };

// DOM element cache
let elements = {};

/**
 * Initialize dashboard component
 * Sets up Chart.js instance and event listeners
 */
export function init() {
  // Cache DOM elements
  cacheElements();

  // Initialize Chart.js
  initTrendChart();

  // Setup controls
  setupTrendControls();

  // Restore saved preferences
  restorePreferences();

  // Subscribe to state changes
  state.subscribe((newState, oldState) => {
    // Update chart when entries change
    if (newState.entries !== oldState.entries || newState.speechEntries !== oldState.speechEntries) {
      updateChart();
      updateStats();
    }

    // Update chart when trend settings change
    if (newState.trend !== oldState.trend) {
      updateChart();
    }
  });

  // Set default trend range
  setDefaultTrendRange();
}

/**
 * Cache frequently accessed DOM elements
 */
function cacheElements() {
  elements = {
    // Chart elements
    trendChart: document.getElementById('trendChart'),
    chartTitle: document.getElementById('chart-title'),
    rangeLabel: document.getElementById('range-label'),
    aggregationHint: document.getElementById('aggregation-hint'),

    // Metric controls
    metricButtons: document.querySelectorAll('#metric-segment button'),
    aggregationSelect: document.getElementById('aggregation-select'),
    compareSelect: document.getElementById('compare-select'),
    cumulativeBadge: document.getElementById('cumulative-badge'),

    // Range controls
    trendStartInput: document.getElementById('trend-start-date'),
    trendEndInput: document.getElementById('trend-end-date'),
    applyRangeBtn: document.getElementById('trend-apply-range'),
    presetTodayBtn: document.getElementById('trend-preset-today'),
    preset7Btn: document.getElementById('trend-preset-7'),
    preset30Btn: document.getElementById('trend-preset-30'),
    toggleCustomDateBtn: document.getElementById('toggle-custom-date'),
    customDatePanel: document.getElementById('custom-date-panel'),

    // Stats elements
    todayFeeds: document.getElementById('today-feeds'),
    totalFeedMl: document.getElementById('total-feed-ml'),
    totalDiapers: document.getElementById('total-diapers'),
    todaySusu: document.getElementById('today-susu'),
    todayPoti: document.getElementById('today-poti'),
    avgTemp: document.getElementById('avg-temp'),
    currentWeight: document.getElementById('current-weight'),

    // Mobile stats elements
    todayFeedsMobile: document.getElementById('today-feeds-mobile'),
    totalDiapersMobile: document.getElementById('total-diapers-mobile'),
    todaySusuMobile: document.getElementById('today-susu-mobile'),
    todayPotiMobile: document.getElementById('today-poti-mobile'),
    avgTempMobile: document.getElementById('avg-temp-mobile'),
    currentWeightMobile: document.getElementById('current-weight-mobile'),

    // Trend stats
    startValue: document.getElementById('start-value'),
    latestValue: document.getElementById('latest-value'),
    valueChange: document.getElementById('value-change'),
    avgChange: document.getElementById('avg-change'),
    changeHelper: document.getElementById('change-helper'),
    avgHelper: document.getElementById('avg-helper'),

    // Feed progress
    targetFeedMl: document.getElementById('target-feed-ml'),
    feedProgressBar: document.getElementById('feed-progress-bar'),
    feedProgressText: document.getElementById('feed-progress-text-compact'),
    basisText: document.getElementById('target-basis-text')
  };
}

/**
 * Initialize Chart.js trend chart
 */
function initTrendChart() {
  if (!elements.trendChart) {
    console.warn('Trend chart canvas not found');
    return;
  }

  const ctx = elements.trendChart.getContext('2d');

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Value',
        data: [],
        borderColor: 'rgb(14, 165, 233)',
        backgroundColor: 'rgba(14, 165, 233, 0.14)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(14, 165, 233)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
        axis: 'x'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 10,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          displayColors: false,
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              const value = context.parsed.y;
              const trendState = state.getState('trend');
              const metric = context.datasetIndex === 0 ? trendState.metric : trendState.compareMetric;
              const unit = getMetricUnit(metric);
              return `${value}${unit}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(15, 23, 42, 0.05)'
          }
        },
        x: {
          grid: {
            color: 'rgba(15, 23, 42, 0.04)'
          }
        }
      }
    }
  });
}

/**
 * Setup trend control event listeners
 */
function setupTrendControls() {
  if (!elements.metricButtons) return;

  const longPressMs = 600;

  // Metric button update helper
  const updateMetricButtonContent = (btn, showIcon) => {
    const label = btn.dataset.label || btn.textContent.trim();
    const icon = btn.dataset.icon;
    if (showIcon && icon) {
      btn.innerHTML = `<span class="mr-1">${icon}</span><span>${label}</span>`;
    } else {
      btn.textContent = label;
    }
  };

  // Cumulative UI state
  const setCumulativeUI = () => {
    const trendState = state.getState('trend');
    const isCumulative = trendState.cumulative;

    if (elements.cumulativeBadge) {
      elements.cumulativeBadge.classList.toggle('hidden', !isCumulative);
    }

    const activeBtn = document.querySelector('#metric-segment .metric-tab.active');
    document.querySelectorAll('#metric-segment .metric-tab').forEach(b => {
      b.classList.remove('cumulative-active');
      updateMetricButtonContent(b, false);
    });

    if (isCumulative && activeBtn) {
      activeBtn.classList.add('cumulative-active');
      updateMetricButtonContent(activeBtn, true);
      activeBtn.title = 'Cumulative view (long-press to toggle)';
    } else if (activeBtn) {
      activeBtn.title = 'Long-press to toggle cumulative';
    }
  };

  // Metric button handlers
  elements.metricButtons.forEach(btn => {
    let pressTimer = null;
    let longPressHandled = false;

    const clearPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    btn.addEventListener('pointerdown', () => {
      longPressHandled = false;
      clearPress();
      pressTimer = setTimeout(() => {
        longPressHandled = true;
        const currentCumulative = state.getState('trend.cumulative');
        state.setState({
          trend: { cumulative: !currentCumulative }
        });
        localStorage.setItem(STORAGE_KEYS.cumulative, !currentCumulative ? '1' : '0');
        setCumulativeUI();
        updateChart();
      }, longPressMs);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
      btn.addEventListener(evt, clearPress);
    });

    btn.addEventListener('click', () => {
      if (longPressHandled) {
        longPressHandled = false;
        return;
      }
      elements.metricButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const metric = btn.dataset.metric;
      state.setState({ trend: { metric } });
      localStorage.setItem(STORAGE_KEYS.metric, metric);
      setCumulativeUI();
      updateChart();
    });
  });

  // Aggregation select
  if (elements.aggregationSelect) {
    elements.aggregationSelect.addEventListener('change', (e) => {
      const range = e.target.value;
      state.setState({ trend: { range } });
      localStorage.setItem(STORAGE_KEYS.range, range);
      updateChart();
    });
  }

  // Compare select
  if (elements.compareSelect) {
    elements.compareSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      const compareMetric = val === 'none' ? null : val;
      state.setState({ trend: { compareMetric } });
      updateChart();
    });
  }

  // Custom date toggle
  if (elements.toggleCustomDateBtn && elements.customDatePanel) {
    elements.toggleCustomDateBtn.addEventListener('click', () => {
      elements.customDatePanel.classList.toggle('hidden');
    });
  }

  // Range application
  const applyTrendRange = async () => {
    const parsed = parseTrendRangeFromInputs();
    if (!parsed) return;
    clearPresetStates();
    trendRange = parsed;
    await loadEntries();
  };

  if (elements.applyRangeBtn) {
    elements.applyRangeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      elements.applyRangeBtn.disabled = true;
      await applyTrendRange();
      elements.applyRangeBtn.disabled = false;
    });
  }

  // Auto-apply on date change
  const autoApply = () => {
    if (elements.trendStartInput?.value && elements.trendEndInput?.value) {
      applyTrendRange();
    }
  };

  if (elements.trendStartInput) {
    elements.trendStartInput.addEventListener('change', autoApply);
  }
  if (elements.trendEndInput) {
    elements.trendEndInput.addEventListener('change', autoApply);
  }

  // Preset buttons
  const clearPresetStates = () => {
    const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
    const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];

    [elements.presetTodayBtn, elements.preset7Btn, elements.preset30Btn].forEach(btn => {
      if (!btn) return;
      btn.classList.remove(...activeClasses);
      btn.classList.add(...inactiveClasses);
    });
  };

  const setPreset = async (days, btn) => {
    clearPresetStates();
    if (btn) {
      const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
      const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];
      btn.classList.remove(...inactiveClasses);
      btn.classList.add(...activeClasses);
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);

    trendRange = { start, end };
    setTrendRangeInputs(start, end);
    updateRangeLabel(elements.rangeLabel, formatRangeLabel(start, end));
    await loadEntries();
  };

  if (elements.presetTodayBtn) {
    elements.presetTodayBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await setPreset(1, elements.presetTodayBtn);
    });
  }
  if (elements.preset7Btn) {
    elements.preset7Btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await setPreset(7, elements.preset7Btn);
    });
  }
  if (elements.preset30Btn) {
    elements.preset30Btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await setPreset(30, elements.preset30Btn);
    });
  }

  // Initialize cumulative UI
  setCumulativeUI();
}

/**
 * Update trend chart with current data and filters
 */
export function updateChart() {
  if (!trendChart) return;

  const trendState = state.getState('trend');
  const entries = state.getState('entries');

  const rangeInfo = getRangeBounds(trendState.range);
  if (!rangeInfo) return;

  const { start, end, groupBy, label } = rangeInfo;
  const metric = trendState.metric;
  const compare = trendState.compareMetric;
  const isCumulative = trendState.cumulative;
  const unit = getMetricUnit(metric);
  const compareUnit = compare ? getMetricUnit(compare) : unit;

  // Clean up y1 scale at the start to avoid stale references
  if (!compare || compareUnit === unit) {
    delete trendChart.options.scales.y1;
  }

  updateRangeLabel(elements.rangeLabel, label);
  updateAggregationHint(elements.aggregationHint, trendState.range);

  // Filter entries by range
  const filteredEntries = entries
    .filter(e => {
      const ts = new Date(e.timestamp);
      return ts >= start && ts <= end;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (filteredEntries.length === 0) {
    trendChart.data.labels = ['No data'];
    trendChart.data.datasets[0].data = [];
    trendChart.update();
    updateTrendStats(null, null, null, null, unit);
    return;
  }

  // Group and calculate primary metric
  const grouped = groupByTime(filteredEntries, groupBy, metric, start);
  const primaryValues = isCumulative ? toCumulative(grouped.values) : grouped.values;

  // Update primary dataset
  trendChart.data.labels = grouped.labels;
  trendChart.data.datasets[0].data = primaryValues;
  const colors = getMetricColor(metric, 0);
  trendChart.data.datasets[0].label = getMetricTitle(metric);
  trendChart.data.datasets[0].borderColor = colors.border;
  trendChart.data.datasets[0].backgroundColor = colors.bg;
  trendChart.data.datasets[0].pointBackgroundColor = colors.border;
  trendChart.data.datasets[0].borderWidth = 3;
  trendChart.data.datasets[0].pointRadius = 6;
  trendChart.data.datasets[0].pointHoverRadius = 8;
  trendChart.data.datasets[0].borderDash = [];
  trendChart.data.datasets[0].fill = true;
  trendChart.data.datasets[0].yAxisID = 'y';

  // Handle comparison metric
  if (compare) {
    const groupedCompare = groupByTime(filteredEntries, groupBy, compare, start);
    trendChart.data.datasets[1] = trendChart.data.datasets[1] || {};
    trendChart.data.datasets[1].data = groupedCompare.values;
    trendChart.data.datasets[1].label = getMetricTitle(compare);
    const cColors = getMetricColor(compare, 1);
    trendChart.data.datasets[1].borderColor = cColors.border;
    trendChart.data.datasets[1].backgroundColor = cColors.bg;
    trendChart.data.datasets[1].pointBackgroundColor = cColors.border;
    trendChart.data.datasets[1].borderWidth = 2;
    trendChart.data.datasets[1].pointRadius = 5;
    trendChart.data.datasets[1].pointHoverRadius = 7;
    trendChart.data.datasets[1].borderDash = [6, 4];
    trendChart.data.datasets[1].fill = false;
    // Set yAxisID - will be 'y1' only if units differ (scale created below)
    trendChart.data.datasets[1].yAxisID = compareUnit !== unit ? 'y1' : 'y';
  } else {
    // Remove comparison dataset and ensure no lingering references
    if (trendChart.data.datasets.length > 1) {
      trendChart.data.datasets.splice(1);
    }
  }

  // Update chart title
  if (elements.chartTitle) {
    elements.chartTitle.textContent = compare
      ? `${getMetricTitle(metric)} vs ${getMetricTitle(compare)}`
      : getMetricTitle(metric);
  }

  // Update chart scales
  trendChart.options.scales.y.ticks = {
    callback: function (value) {
      return `${value}${unit}`;
    },
    maxTicksLimit: 5
  };

  // Create y1 scale only if comparing metrics with different units
  if (compare && compareUnit !== unit) {
    trendChart.options.scales.y1 = {
      position: 'right',
      beginAtZero: false,
      grid: { display: false },
      ticks: {
        callback: function (value) {
          return `${value}${compareUnit}`;
        },
        maxTicksLimit: 5
      }
    };
  }

  trendChart.options.scales.x.ticks = {
    maxTicksLimit: Math.min(grouped.labels.length, groupBy === 'day' ? 12 : groupBy === 'week' ? 12 : 12) || 6,
    color: '#475569'
  };

  trendChart.options.scales.x.grid = { color: 'rgba(15, 23, 42, 0.05)' };
  trendChart.options.scales.y.grid = { color: 'rgba(15, 23, 42, 0.07)' };

  // Update legend
  trendChart.options.plugins.legend = {
    display: !!compare,
    position: 'top',
    labels: { usePointStyle: true, boxWidth: 10 }
  };

  // Update tooltip
  trendChart.options.plugins.tooltip.callbacks = {
    title: function (context) {
      return context[0].label;
    },
    label: function (context) {
      const value = context.parsed.y;
      const datasetLabel = context.dataset?.label ? `${context.dataset.label}: ` : '';
      const currentUnit = context.datasetIndex === 1 ? compareUnit : unit;
      return `${datasetLabel}${value}${currentUnit}`;
    }
  };

  trendChart.update();

  // Update trend statistics
  if (primaryValues.length > 0) {
    const startVal = primaryValues[0];
    const latest = primaryValues[primaryValues.length - 1];
    const change = latest - startVal;
    const avgChange = primaryValues.length > 1
      ? change / (primaryValues.length - 1)
      : 0;
    updateTrendStats(startVal, latest, change, avgChange, unit);
  }
}

/**
 * Update statistics cards with current data
 */
export function updateStats() {
  const entries = state.getState('entries');
  const filters = state.getState('filters');
  const historyRange = filters.dateRange;

  // Filter entries by history range
  const rangeEntries = entries.filter(e => {
    const ts = new Date(e.timestamp);
    if (historyRange.start && ts < historyRange.start) return false;
    if (historyRange.end && ts > historyRange.end) return false;
    return true;
  });

  // Feeds count and average
  const feedEntries = rangeEntries.filter(e => e.feed_amount > 0 || e.feed_type);
  const feedsCount = feedEntries.length;
  const feedAmounts = feedEntries.filter(e => e.feed_amount > 0).map(e => e.feed_amount);
  const totalFeedMl = feedAmounts.reduce((sum, amt) => sum + amt, 0);
  const avgFeed = feedAmounts.length > 0
    ? Math.round(feedAmounts.reduce((sum, amt) => sum + amt, 0) / feedAmounts.length)
    : 0;

  if (elements.todayFeeds) elements.todayFeeds.textContent = `${feedsCount} | ${avgFeed}ml`;
  if (elements.todayFeedsMobile) elements.todayFeedsMobile.textContent = `${feedsCount} | ${avgFeed}ml`;
  if (elements.totalFeedMl) elements.totalFeedMl.textContent = `${Math.round(totalFeedMl)} ml`;

  // Feed target progress
  const applicableWeights = entries
    .filter(e => e.weight > 0 && e.timestamp)
    .filter(e => {
      if (historyRange.end) return new Date(e.timestamp) <= historyRange.end;
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const latestWeight = applicableWeights.length > 0 ? applicableWeights[0].weight : 0;

  if (latestWeight > 0) {
    const weightKg = (latestWeight / 1000).toFixed(2);
    const dailyTarget = Math.round((latestWeight / 1000) * 150);

    let days = 1;
    if (historyRange.start && historyRange.end) {
      const diffTime = Math.abs(historyRange.end - historyRange.start);
      days = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
    }

    const dailyAvg = totalFeedMl / days;
    const percent = Math.min(100, Math.round((dailyAvg / dailyTarget) * 100));

    if (elements.feedProgressBar) {
      elements.feedProgressBar.style.width = `${percent}%`;
      elements.feedProgressBar.className = 'h-full bg-blue-500 rounded-full transition-all duration-500';
    }

    if (elements.feedProgressText) elements.feedProgressText.textContent = `${percent}%`;
    if (elements.basisText) elements.basisText.textContent = `Goal: ${dailyTarget} ml (${weightKg}kg)`;
  } else {
    if (elements.feedProgressBar) elements.feedProgressBar.style.width = '0%';
    if (elements.feedProgressText) elements.feedProgressText.textContent = '0%';
    if (elements.basisText) elements.basisText.textContent = 'Goal: --';
  }

  // Susu total
  const susuTotal = rangeEntries.reduce((sum, e) => sum + (e.susu_count || 0), 0);
  if (elements.todaySusu) elements.todaySusu.textContent = susuTotal;
  if (elements.todaySusuMobile) elements.todaySusuMobile.textContent = susuTotal;

  // Poti total
  const potiTotal = rangeEntries.reduce((sum, e) => sum + (e.poti_count || 0), 0);
  if (elements.todayPoti) elements.todayPoti.textContent = potiTotal;
  if (elements.todayPotiMobile) elements.todayPotiMobile.textContent = potiTotal;

  // Combined diaper total
  const diaperTotal = rangeEntries.reduce((sum, e) => {
    const itemType = getEntryItemType(e);
    if (itemType === 'diaper') {
      return sum + (e.susu_count || 0) + (e.poti_count || 0);
    }
    return sum;
  }, 0);
  if (elements.totalDiapers) elements.totalDiapers.textContent = diaperTotal;
  if (elements.totalDiapersMobile) elements.totalDiapersMobile.textContent = diaperTotal;

  // Average temperature
  const temps = rangeEntries.filter(e => e.temperature).map(e => parseFloat(e.temperature));
  if (temps.length > 0) {
    const avgTemp = (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1);
    if (elements.avgTemp) {
      elements.avgTemp.textContent = avgTemp;
      elements.avgTemp.classList.toggle('text-red-600', avgTemp > 38);
    }
    if (elements.avgTempMobile) {
      elements.avgTempMobile.textContent = avgTemp;
      elements.avgTempMobile.classList.toggle('text-red-600', avgTemp > 38);
    }
  } else {
    if (elements.avgTemp) elements.avgTemp.textContent = '--';
    if (elements.avgTempMobile) elements.avgTempMobile.textContent = '--';
  }

  // Current weight
  const weightEntries = rangeEntries.filter(e => e.weight > 0).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (weightEntries.length > 0) {
    if (elements.currentWeight) elements.currentWeight.textContent = weightEntries[0].weight;
    if (elements.currentWeightMobile) elements.currentWeightMobile.textContent = weightEntries[0].weight;
  } else {
    if (elements.currentWeight) elements.currentWeight.textContent = '--';
    if (elements.currentWeightMobile) elements.currentWeightMobile.textContent = '--';
  }
}

/**
 * Group entries by time period (hour, day, week, month)
 * @param {Array} entries - Filtered and sorted entries
 * @param {string} groupBy - Time period: 'hour', 'day', 'week', 'month'
 * @param {string} metric - Metric to calculate
 * @param {Date} rangeStart - Start of range for complete time series
 * @returns {{labels: Array, values: Array}} Grouped data
 */
function groupByTime(entries, groupBy, metric, rangeStart) {
  const grouped = {};

  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    let key;

    if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);
      key = weekStart.toISOString();
    } else if (groupBy === 'hour') {
      const hourStart = new Date(date);
      hourStart.setMinutes(0, 0, 0);
      key = hourStart.toISOString();
    } else if (groupBy === 'month') {
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      key = monthStart.toISOString();
    } else {
      const dayKey = new Date(date);
      dayKey.setHours(0, 0, 0, 0);
      key = dayKey.toISOString();
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(entry);
  });

  const sortedKeys = Object.keys(grouped).sort();
  const labels = sortedKeys.map(key => {
    const d = new Date(key);
    if (groupBy === 'hour') {
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' });
    }
    if (groupBy === 'week') {
      return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (groupBy === 'month') {
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  const values = sortedKeys.map(key => {
    const groupEntries = grouped[key];
    return calculateMetricValue(groupEntries, metric);
  });

  return { labels, values };
}

/**
 * Calculate metric value for a group of entries
 * @param {Array} entries - Entries in time group
 * @param {string} metric - Metric to calculate
 * @returns {number} Calculated value
 */
function calculateMetricValue(entries, metric) {
  switch (metric) {
    case 'weight-avg':
      const weights = entries.filter(e => e.weight > 0).map(e => e.weight);
      return weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0;

    case 'temp-avg':
      const temps = entries.filter(e => e.temperature).map(e => parseFloat(e.temperature));
      return temps.length > 0 ? parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)) : 0;

    case 'feed-total':
      return entries.reduce((sum, e) => sum + (e.feed_amount || 0), 0);

    case 'feed-avg':
      const feedAmounts = entries.filter(e => e.feed_amount > 0).map(e => e.feed_amount);
      return feedAmounts.length > 0 ? Math.round(feedAmounts.reduce((a, b) => a + b, 0) / feedAmounts.length) : 0;

    case 'feed-count':
      return entries.filter(e => e.feed_amount > 0 || e.feed_type).length;

    case 'poti-count':
      return entries.reduce((sum, e) => sum + (e.poti_count || 0), 0);

    case 'susu-count':
      return entries.reduce((sum, e) => sum + (e.susu_count || 0), 0);

    case 'diaper-count':
      return computeDiaperCount(entries);

    default:
      return 0;
  }
}

/**
 * Calculate total diaper count (diaper items only, not nappies)
 * @param {Array} entries - Entries to count
 * @returns {number} Total diaper count
 */
function computeDiaperCount(entries) {
  return entries.reduce((sum, entry) => {
    const itemType = getEntryItemType(entry);
    if (itemType !== 'diaper') return sum;
    return sum + (entry.susu_count || 0) + (entry.poti_count || 0);
  }, 0);
}

/**
 * Convert data points to cumulative values
 * @param {Array<number>} values - Array of values
 * @returns {Array<number>} Cumulative values
 */
function toCumulative(values) {
  let running = 0;
  return values.map(v => {
    running += v;
    return running;
  });
}

/**
 * Get metric color scheme
 * @param {string} metric - Metric identifier
 * @param {number} order - Dataset order (for fallback colors)
 * @returns {{border: string, bg: string}} Color configuration
 */
function getMetricColor(metric, order = 0) {
  const metricConfig = METRICS[metric];
  if (metricConfig && metricConfig.color) {
    return metricConfig.color;
  }

  // Fallback colors for comparison
  const fallback = [
    { border: 'rgb(14, 165, 233)', bg: 'rgba(14, 165, 233, 0.14)' },
    { border: 'rgb(239, 68, 68)', bg: 'rgba(239, 68, 68, 0.12)' },
    { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.12)' },
    { border: 'rgb(245, 158, 11)', bg: 'rgba(245, 158, 11, 0.12)' },
    { border: 'rgb(99, 102, 241)', bg: 'rgba(99, 102, 241, 0.12)' }
  ];
  return fallback[order % fallback.length];
}

/**
 * Get metric display title
 * @param {string} metric - Metric identifier
 * @returns {string} Display title
 */
function getMetricTitle(metric) {
  const metricConfig = METRICS[metric];
  return metricConfig ? metricConfig.title : 'Trend';
}

/**
 * Get metric unit
 * @param {string} metric - Metric identifier
 * @returns {string} Unit string (may be empty)
 */
function getMetricUnit(metric) {
  const metricConfig = METRICS[metric];
  return metricConfig ? metricConfig.unit : '';
}

/**
 * Update trend statistics display
 * @param {number|null} start - Starting value
 * @param {number|null} latest - Latest value
 * @param {number|null} change - Total change
 * @param {number|null} avgChange - Average change per period
 * @param {string} unit - Unit string
 */
function updateTrendStats(start, latest, change, avgChange, unit = '') {
  if (!elements.startValue) return;

  elements.startValue.textContent = start !== null ? `${start}${unit}` : '--';
  elements.latestValue.textContent = latest !== null ? `${latest}${unit}` : '--';

  if (change !== null) {
    const prefix = change >= 0 ? '+' : '';
    const valueText = `${prefix}${change.toFixed ? change.toFixed(1) : change}${unit}`;
    elements.valueChange.textContent = valueText;
    const positive = change >= 0;
    elements.valueChange.classList.toggle('text-emerald-700', positive);
    elements.valueChange.classList.toggle('text-amber-600', !positive);
    if (elements.changeHelper) {
      elements.changeHelper.textContent = positive ? 'Healthy gain this range' : 'Watch for dips';
    }
  } else {
    elements.valueChange.textContent = '--';
    if (elements.changeHelper) {
      elements.changeHelper.textContent = 'Not enough data';
    }
  }

  if (avgChange !== null) {
    const prefix = avgChange >= 0 ? '+' : '';
    const valueText = `${prefix}${avgChange.toFixed ? avgChange.toFixed(1) : avgChange}${unit}`;
    elements.avgChange.textContent = valueText;
    const positive = avgChange >= 0;
    elements.avgChange.classList.toggle('text-emerald-700', positive);
    elements.avgChange.classList.toggle('text-amber-600', !positive);
    if (elements.avgHelper) {
      elements.avgHelper.textContent = positive ? 'Steady upward trend' : 'Declining trend';
    }
  } else {
    elements.avgChange.textContent = '--';
    if (elements.avgHelper) {
      elements.avgHelper.textContent = 'Not enough data';
    }
  }
}

/**
 * Get range bounds for chart filtering
 * @param {string} aggregation - Time aggregation: 'hour', 'day', 'week', 'month'
 * @returns {{start: Date, end: Date, groupBy: string, label: string}|null} Range info
 */
function getRangeBounds(aggregation) {
  if (!trendRange.start || !trendRange.end) {
    setDefaultTrendRange();
  }

  if (!trendRange.start || !trendRange.end) return null;

  const groupBy = aggregation === 'hour'
    ? 'hour'
    : aggregation === 'week'
      ? 'week'
      : aggregation === 'month'
        ? 'month'
        : 'day';
  const label = formatRangeLabel(trendRange.start, trendRange.end);
  return { start: trendRange.start, end: trendRange.end, groupBy, label };
}

/**
 * Format date range as label
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {string} Formatted label
 */
function formatRangeLabel(start, end) {
  if (!start || !end) return 'Range';

  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (start.getFullYear() === end.getFullYear()) {
    return `${startLabel} – ${endLabel}, ${start.getFullYear()}`;
  }

  return `${startLabel}, ${start.getFullYear()} – ${endLabel}, ${end.getFullYear()}`;
}

/**
 * Update range label element
 * @param {HTMLElement} el - Element to update
 * @param {string} labelText - Label text
 */
function updateRangeLabel(el, labelText) {
  if (!el) return;
  el.textContent = labelText || 'Range';
}

/**
 * Update aggregation hint element
 * @param {HTMLElement} el - Element to update
 * @param {string} aggregation - Aggregation type
 */
function updateAggregationHint(el, aggregation) {
  if (!el) return;
  const label = aggregation === 'hour' ? 'Grouped by Hour'
    : aggregation === 'day' ? 'Grouped by Day'
      : aggregation === 'month' ? 'Grouped by Month'
        : 'Grouped by Week';
  el.textContent = label;
}

/**
 * Set default trend range (7 days)
 */
function setDefaultTrendRange() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  trendRange = { start, end };

  setTrendRangeInputs(start, end);
  if (elements.rangeLabel) {
    updateRangeLabel(elements.rangeLabel, formatRangeLabel(start, end));
  }

  // Highlight preset button
  if (elements.preset7Btn) {
    const activeClasses = ['bg-white', 'shadow-sm', 'text-slate-800'];
    const inactiveClasses = ['text-slate-600', 'hover:bg-white', 'hover:shadow-sm'];
    elements.preset7Btn.classList.remove(...inactiveClasses);
    elements.preset7Btn.classList.add(...activeClasses);
  }
}

/**
 * Set trend range input values
 * @param {Date} start - Start date
 * @param {Date} end - End date
 */
function setTrendRangeInputs(start, end) {
  if (!elements.trendStartInput || !elements.trendEndInput) return;
  const pad = (n) => String(n).padStart(2, '0');
  elements.trendStartInput.value = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  elements.trendEndInput.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

/**
 * Parse trend range from input elements
 * @returns {{start: Date, end: Date}|null} Parsed range or null if invalid
 */
function parseTrendRangeFromInputs() {
  const startVal = elements.trendStartInput?.value;
  const endVal = elements.trendEndInput?.value;
  if (!startVal || !endVal) {
    showToast('Please select both start and end dates', 'error');
    return null;
  }

  const start = new Date(`${startVal}T00:00:00`);
  const end = new Date(`${endVal}T23:59:59.999`);

  if (isNaN(start) || isNaN(end)) {
    showToast('Invalid dates selected', 'error');
    return null;
  }

  if (end < start) {
    showToast('End date must be after start date', 'error');
    return null;
  }

  return { start, end };
}

/**
 * Load entries from API
 * Uses combined range from history and trend filters
 */
async function loadEntries() {
  try {
    const filters = state.getState('filters');
    const historyRange = filters.dateRange;

    const params = new URLSearchParams();
    const rangeStarts = [historyRange?.start, trendRange?.start].filter(Boolean);
    const rangeEnds = [historyRange?.end, trendRange?.end].filter(Boolean);
    const fetchStart = rangeStarts.length ? rangeStarts.reduce((earliest, current) => current < earliest ? current : earliest) : null;
    const fetchEnd = rangeEnds.length ? rangeEnds.reduce((latest, current) => current > latest ? current : latest) : null;

    if (fetchStart) params.set('start', formatDateTimeForBackend(fetchStart));
    if (fetchEnd) params.set('end', formatDateTimeForBackend(fetchEnd));

    const query = params.toString() ? `?${params.toString()}` : '';
    const [entriesResp, speechResp] = await Promise.all([
      fetch(`${API_BASE_URL}/entries${query}`),
      fetch(`${API_BASE_URL}/speech_entries${query}`)
    ]);

    if (!entriesResp.ok || !speechResp.ok) {
      throw new Error('Failed to load entries');
    }

    const entries = await entriesResp.json();
    const speechEntries = await speechResp.json();

    state.setState({ entries, speechEntries });
  } catch (error) {
    console.error('Error loading entries:', error);
    showToast('Error loading entries', 'error');
  }
}

/**
 * Format Date for backend API (YYYY-MM-DDTHH:mm:ss)
 * @param {Date} date - Date to format
 * @returns {string|null} Formatted string
 */
function formatDateTimeForBackend(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Restore user preferences from localStorage
 */
function restorePreferences() {
  const storedMetric = localStorage.getItem(STORAGE_KEYS.metric);
  const storedRange = localStorage.getItem(STORAGE_KEYS.range);
  const storedCumulative = localStorage.getItem(STORAGE_KEYS.cumulative);

  if (storedMetric) {
    state.setState({ trend: { metric: storedMetric } });
    elements.metricButtons?.forEach(b => b.classList.toggle('active', b.dataset.metric === storedMetric));
  }

  if (storedRange && elements.aggregationSelect) {
    state.setState({ trend: { range: storedRange } });
    elements.aggregationSelect.value = storedRange;
  }

  if (storedCumulative === '1') {
    state.setState({ trend: { cumulative: true } });
  }
}

// Public API
export const dashboard = {
  init,
  updateChart,
  updateStats,
  setMetric: (metric) => state.setState({ trend: { metric } }),
  setRange: (range) => state.setState({ trend: { range } }),
  toggleCumulative: () => {
    const current = state.getState('trend.cumulative');
    state.setState({ trend: { cumulative: !current } });
  }
};
