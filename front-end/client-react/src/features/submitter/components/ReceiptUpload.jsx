import { useRef, useState } from "react";
import { Icon } from "./Icons";
import { validateReceipt } from "../receiptValidation";

export default function ReceiptUpload({
  file,
  onFileChange,
  error,
  onInvalidFile,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");

  const openPicker = (event) => {
    event?.stopPropagation();
    inputRef.current?.click();
  };

  const selectFile = (candidate) => {
    if (!candidate) return;
    const message = validateReceipt(candidate);

    if (message) {
      setLocalError(message);
      onFileChange(null);
      onInvalidFile?.(message);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setLocalError("");
    onFileChange(candidate);
  };

  const removeFile = (event) => {
    event.stopPropagation();
    onFileChange(null);
    setLocalError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="submit-left space-y-4">
      <div className="card">
        <div className="card-header">
          <span className="card-title">Receipt</span>
        </div>
        <div className="card-content">
          <div
            className={`dropzone${dragging ? " dragover" : ""}${error || localError ? " error" : ""}`}
            onClick={openPicker}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            {!file ? (
              <div className="dropzone-empty">
                <div className="dropzone-icon">
                  <Icon name="upload" size={32} />
                </div>
                <p
                  className="text-sm font-medium text-white"
                  style={{ marginBottom: 4 }}
                >
                  Click to upload or drag and drop
                </p>
                <p
                  className="text-xs text-text-muted"
                  style={{ marginBottom: 24 }}
                >
                  PNG, JPG or PDF (max. 5MB)
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={openPicker}
                >
                  Select File
                </button>
              </div>
            ) : (
              <div className="dropzone-preview">
                <div className="preview-file-icon">
                  <Icon name="file" size={32} />
                </div>
                <p
                  className="text-sm font-medium text-white"
                  style={{
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <div className="react-file-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={openPicker}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={removeFile}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
          {(localError || error) && (
            <p className="text-xs react-field-error">{localError || error}</p>
          )}
        </div>
      </div>
      <div className="tip-card">
        <Icon name="info" />
        <p>
          Ensure your receipt clearly shows the merchant name, date, and total
          amount to avoid delays.
        </p>
      </div>
    </div>
  );
}
