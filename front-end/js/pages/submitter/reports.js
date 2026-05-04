document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
    var expenses = FinStack.getExpenses().slice(0, 25);

    function renderBarChart(container, items, colors) {
        if (!container) return;
        var max = items.reduce(function (current, item) {
            return Math.max(current, item.value);
        }, 1);
        container.innerHTML = '<div style="display:flex;align-items:flex-end;gap:12px;height:100%;padding-top:16px;">' +
            items.map(function (item, index) {
                var height = Math.max(20, Math.round((item.value / max) * 100));
                var color = colors[index % colors.length];
                return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">' +
                    '<div style="font-size:11px;color:#d4d4d8;margin-bottom:8px;">' + item.value + '</div>' +
                    '<div style="width:100%;max-width:42px;height:' + height + '%;min-height:20px;border-radius:14px 14px 6px 6px;background:' + color + ';"></div>' +
                    '<div style="margin-top:10px;font-size:12px;color:#a1a1aa;text-align:center;">' + item.label + '</div>' +
                '</div>';
            }).join('') +
        '</div>';
    }

    function renderDonutChart(container, items, colors) {
        if (!container) return;
        var total = items.reduce(function (sum, item) { return sum + item.value; }, 0) || 1;
        var current = 0;
        var segments = items.map(function (item, index) {
            var dash = ((item.value / total) * 100).toFixed(2);
            var segment = '<circle cx="18" cy="18" r="15.915" fill="none" stroke="' + colors[index % colors.length] + '" stroke-width="4" stroke-dasharray="' + dash + ' ' + (100 - dash) + '" stroke-dashoffset="' + (-current).toFixed(2) + '"></circle>';
            current += Number(dash);
            return segment;
        }).join('');
        container.innerHTML = '<div style="display:grid;place-items:center;height:100%;">' +
            '<svg viewBox="0 0 36 36" style="width:160px;height:160px;transform:rotate(-90deg);">' +
              '<circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4"></circle>' +
              segments +
            '</svg>' +
            '<div style="margin-top:14px;display:grid;gap:8px;width:100%;">' +
              items.map(function (item, index) {
                  return '<div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;color:#d4d4d8;"><span style="display:inline-flex;align-items:center;gap:8px;"><span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:' + colors[index % colors.length] + ';"></span>' + item.label + '</span><strong>' + item.value + '</strong></div>';
              }).join('') +
            '</div>' +
        '</div>';
    }

    // Calculate aggregate risk data from expenses
    var totalRisk = 0;
    var flagCounts = { mismatch: 0, duplicate: 0, low_ocr_quality: 0, suspicious_amount: 0, none: 0 };
    var confidences = [];

    expenses.forEach(function (e) {
        totalRisk += (e.risk_score || 0);
        var flag = e.flag || 'none';
        if (flagCounts.hasOwnProperty(flag)) flagCounts[flag]++;
        if (e.extraction_confidence) confidences.push(e.extraction_confidence);
    });

    var avgRisk = expenses.length > 0 ? Math.round(totalRisk / expenses.length) : 0;
    var riskLabel = FinStack.getRiskLabel(avgRisk);

    // Render risk score gauge
    var gaugeEl = document.getElementById('riskScore');
    if (gaugeEl) {
        var color = avgRisk < 30 ? '#10b981' : avgRisk < 70 ? '#f59e0b' : '#ef4444';
        gaugeEl.innerHTML = '<div style="position:relative;width:160px;height:160px;margin:0 auto;">' +
            '<svg viewBox="0 0 36 36" style="transform:rotate(-90deg);width:100%;height:100%;">' +
            '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2.5"/>' +
            '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-dasharray="' + avgRisk + ', 100" stroke-linecap="round"/>' +
            '</svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span style="font-size:32px;font-weight:700;color:white;">' + avgRisk + '</span><span style="font-size:12px;color:#a1a1aa;">' + riskLabel + '</span></div></div>';
    }

    // Render flags summary
    var flagsEl = document.getElementById('flagsSummary');
    if (flagsEl) {
        var flagInfo = [
            { key: 'mismatch', label: 'Amount Mismatch', color: '#f59e0b', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
            { key: 'duplicate', label: 'Duplicate Entry', color: '#ef4444', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="2" width="13" height="13" rx="2"/><path d="M4 8.67V19a2 2 0 0 0 2 2h10.33"/></svg>' },
            { key: 'low_ocr_quality', label: 'Low OCR Quality', color: '#8b5cf6', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' },
            { key: 'suspicious_amount', label: 'Suspicious Amount', color: '#ec4899', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' }
        ];
        flagsEl.innerHTML = flagInfo.map(function (f) {
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(39,39,42,0.5);">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:' + f.color + '20;color:' + f.color + ';">' + f.icon + '</div>' +
                '<span style="font-size:14px;color:#d4d4d8;">' + f.label + '</span></div>' +
                '<span style="font-size:18px;font-weight:600;color:white;">' + flagCounts[f.key] + '</span></div>';
        }).join('');
    }

    // OCR Confidence Chart
    var ocrCtx = document.getElementById('ocrChart');
    if (ocrCtx) {
        // Group OCR by category
        var catConfidence = {};
        expenses.forEach(function (e) {
            if (!e.extraction_confidence) return;
            if (!catConfidence[e.category]) catConfidence[e.category] = [];
            catConfidence[e.category].push(e.extraction_confidence);
        });
        var labels = Object.keys(catConfidence);
        var avgConf = labels.map(function (cat) {
            var arr = catConfidence[cat];
            return Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length);
        });
        var barColors = labels.map(function (_, i) {
            return ['#7c3aed', '#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444'][i % 6];
        });
        var ocrHost = ocrCtx.parentElement;
        if (ocrHost) {
            ocrHost.innerHTML = '';
            var ocrMount = document.createElement('div');
            ocrMount.style.height = '100%';
            ocrHost.appendChild(ocrMount);
            renderBarChart(ocrMount, labels.map(function (label, index) {
                return { label: label, value: avgConf[index] };
            }), barColors);
        }
    }

    // Risk distribution mini-chart
    var riskCtx = document.getElementById('riskDistChart');
    if (riskCtx) {
        var lowCount = 0, modCount = 0, highCount = 0;
        expenses.forEach(function (e) {
            var s = e.risk_score || 0;
            if (s < 30) lowCount++;
            else if (s < 70) modCount++;
            else highCount++;
        });
        var riskHost = riskCtx.parentElement;
        if (riskHost) {
            riskHost.innerHTML = '';
            var riskMount = document.createElement('div');
            riskMount.style.height = '100%';
            riskHost.appendChild(riskMount);
            renderDonutChart(riskMount, [
                { label: 'Low Risk', value: lowCount },
                { label: 'Moderate Risk', value: modCount },
                { label: 'High Risk', value: highCount }
            ], ['#10b981', '#f59e0b', '#ef4444']);
        }
    }

    // Summary stats
    var summaryEl = document.getElementById('riskSummary');
    if (summaryEl) {
        var totalFlags = flagCounts.mismatch + flagCounts.duplicate + flagCounts.low_ocr_quality + flagCounts.suspicious_amount;
        var avgConfidence = confidences.length > 0 ? Math.round(confidences.reduce(function (a, b) { return a + b; }, 0) / confidences.length) : 0;
        summaryEl.innerHTML =
            '<div class="kpi-card" style="padding:16px;"><div class="kpi-label">Avg Risk Score</div><div class="kpi-value" style="color:' + (avgRisk < 30 ? '#10b981' : avgRisk < 70 ? '#f59e0b' : '#ef4444') + ';">' + avgRisk + '%</div></div>' +
            '<div class="kpi-card" style="padding:16px;"><div class="kpi-label">Total Flags</div><div class="kpi-value">' + totalFlags + '</div></div>' +
            '<div class="kpi-card" style="padding:16px;"><div class="kpi-label">Avg OCR Confidence</div><div class="kpi-value" style="color:#22d3ee;">' + avgConfidence + '%</div></div>' +
            '<div class="kpi-card" style="padding:16px;"><div class="kpi-label">Expenses Analyzed</div><div class="kpi-value">' + expenses.length + '</div></div>';
    }
    });
});
