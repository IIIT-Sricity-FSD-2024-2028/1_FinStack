document.addEventListener('DOMContentLoaded', function () {
    FinStack.whenReady(function () {
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('fileInput');
    var emptyState = document.getElementById('dropzoneEmpty');
    var previewState = document.getElementById('dropzonePreview');
    var fileNameEl = document.getElementById('fileName');
    var fileSizeEl = document.getElementById('fileSize');
    var fileError = document.getElementById('fileError');
    var categorySelect = document.getElementById('category');
    var currentFile = null;

    var categories = window.FinStackStore.getCategories().filter(function (category) {
        return category.status === 'Active';
    });
    categorySelect.innerHTML = '<option value="none">Select category</option>' +
        categories.map(function (category) {
            return '<option value="' + category.id + '">' + category.name + '</option>';
        }).join('');

    dropzone.addEventListener('click', function () { fileInput.click(); });
    document.getElementById('selectFileBtn').addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
    document.getElementById('replaceFileBtn').addEventListener('click', function (e) { e.stopPropagation(); fileInput.click(); });
    document.getElementById('removeFileBtn').addEventListener('click', function (e) {
        e.stopPropagation();
        currentFile = null;
        fileInput.value = '';
        emptyState.style.display = '';
        previewState.style.display = 'none';
        dropzone.classList.remove('error');
        fileError.style.display = 'none';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', function (e) {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) showFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) showFile(e.target.files[0]);
    });

    function showFile(file) {
        currentFile = file;
        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        emptyState.style.display = 'none';
        previewState.style.display = '';
        dropzone.classList.remove('error');
        fileError.style.display = 'none';
    }

    document.getElementById('expenseForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var errors = {};
        var amountVal = document.getElementById('amount').value;
        var merchantVal = document.getElementById('merchant').value;
        var dateVal = document.getElementById('date').value;
        var cat = document.getElementById('category');
        var paymentMethod = document.getElementById('payment-method').value;
        var notesVal = document.getElementById('notes').value;

        if (!amountVal || Number(amountVal) <= 0) errors.amount = true;
        if (!merchantVal.trim()) errors.merchant = true;
        if (!dateVal) errors.date = true;
        if (!cat.value || cat.value === 'none') errors.category = true;
        if (!currentFile) { errors.file = true; dropzone.classList.add('error'); fileError.textContent = 'Receipt upload is required'; fileError.style.display = ''; }

        ['amount', 'merchant', 'category', 'date'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.borderColor = errors[id] ? '#ef4444' : '';
        });

        if (Object.keys(errors).length > 0) {
            showToast('Please fill in all required fields', 'error');
            return;
        }

        // Risk calculation (exact user spec)
        var confidence = FinStack.randomConfidence();
        var flag = FinStack.randomFlag();
        var risk = FinStack.calculateRisk(flag, confidence);

        var categoryLabel = cat.options[cat.selectedIndex] ? cat.options[cat.selectedIndex].text : cat.value;

        var expense = window.FinStackStore.submitExpense({
            amount: Number(amountVal),
            category: categoryLabel,
            categoryId: cat.value,
            merchant: merchantVal.trim(),
            date: dateVal,
            notes: notesVal.trim(),
            paymentMethod: paymentMethod,
            receiptFileName: currentFile ? currentFile.name : '',
            extraction_confidence: confidence,
            flag: flag,
            risk_score: risk
        });

        showToast('Expense ' + expense.id + ' submitted successfully! Risk: ' + FinStack.getRiskLabel(risk), 'success');

        // Reset form
        document.getElementById('expenseForm').reset();
        currentFile = null;
        fileInput.value = '';
        emptyState.style.display = '';
        previewState.style.display = 'none';
        dropzone.classList.remove('error');
        fileError.style.display = 'none';
        ['amount', 'merchant', 'category', 'date'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.borderColor = '';
        });
    });

    document.getElementById('resetBtn').addEventListener('click', function () {
        currentFile = null;
        fileInput.value = '';
        emptyState.style.display = '';
        previewState.style.display = 'none';
        dropzone.classList.remove('error');
        fileError.style.display = 'none';
        ['amount', 'merchant', 'category', 'date'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.style.borderColor = '';
        });
    });
    });
});
