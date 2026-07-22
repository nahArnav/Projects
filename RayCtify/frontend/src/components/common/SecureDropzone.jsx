import { useRef, useState } from "react";
import clsx from "clsx";

export function SecureDropzone({
  accept,
  title,
  helperText,
  onFileSelected,
  selectedLabel,
  compact = false
}) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleSelection = (fileList) => {
    const file = fileList?.[0];
    if (file) {
      onFileSelected(file);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        handleSelection(event.dataTransfer.files);
      }}
      className={clsx(
        "rounded-[1.5rem] border border-dashed px-5 py-5 transition",
        compact ? "min-h-[150px]" : "min-h-[190px]",
        dragActive ? "border-gold bg-gold/10" : "border-line-subtle bg-black/20 hover:border-gold/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => handleSelection(event.target.files)}
      />

      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.24em] text-gold-soft">Upload</div>
          <div className="mt-3 font-display text-2xl text-parchment">{title}</div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-parchment-muted">{helperText}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/15"
          >
            Browse
          </button>
          <div className="text-sm text-parchment-muted">{selectedLabel || "Or drop a file here."}</div>
        </div>
      </div>
    </div>
  );
}
