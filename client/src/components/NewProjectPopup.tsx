import { personal } from '@/lib/api';
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PROJECT_COLORS } from "@/lib/personal-mock-data";
import { cn } from "@/lib/utils";

interface NewProjectPopupProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: { id: string; name: string; baseUrl: string; color: string }) => void;
  isAtLimit?: boolean;
}

export function NewProjectPopup({ open, onClose, onCreated, isAtLimit = false }: NewProjectPopupProps) {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[4].value); // warm slate default
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  const reset = () => {
    setName("");
    setBaseUrl("");
    setColor(PROJECT_COLORS[4].value);
    setLoading(false);
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateName = () => {
    if (!name.trim()) {
      setErrors(e => ({ ...e, name: "Project name is required." }));
      return false;
    }
    setErrors(e => ({ ...e, name: undefined }));
    return true;
  };

  const validateUrl = () => {
    if (!baseUrl.trim()) {
      setErrors(e => ({ ...e, url: "Base URL is required." }));
      return false;
    }
    if (!/^https?:\/\/.+/.test(baseUrl.trim())) {
      setErrors(e => ({ ...e, url: "Must be a valid URL starting with http:// or https://" }));
      return false;
    }
    setErrors(e => ({ ...e, url: undefined }));
    return true;
  };

  const handleSubmit = async () => {
    if (!validateName() || !validateUrl()) return;
    setLoading(true);
    try {
      const project = await personal.createProject({name:name.trim(),baseUrl:baseUrl.trim(),color});
      onCreated(project); reset(); onClose(); navigate(`/personal/projects/${project.id}`);
    } catch (error) { setErrors({name:error instanceof Error ? error.message : 'Project creation failed'}); setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 overflow-hidden gap-0"
        style={{
          width: 460,
          borderRadius: 14,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
        }}
        aria-describedby={undefined}
      >
        {isAtLimit ? (
          <AtLimitState onClose={handleClose} />
        ) : (
          <CreationState
            name={name}
            baseUrl={baseUrl}
            color={color}
            loading={loading}
            errors={errors}
            onNameChange={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
            onBaseUrlChange={v => { setBaseUrl(v); setErrors(e => ({ ...e, url: undefined })); }}
            onColorChange={setColor}
            onNameBlur={validateName}
            onUrlBlur={validateUrl}
            onSubmit={handleSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AtLimitState({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-7 flex flex-col gap-5">
      <div>
        <DialogTitle
          className="text-[16px] font-semibold text-[hsl(var(--text-1))]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          You're at your project limit
        </DialogTitle>
        <p className="text-[13px] text-[hsl(var(--text-2))] mt-1">Free plan · 3 of 3 projects used</p>
      </div>
      <p className="text-[13px] text-[hsl(var(--text-2))] leading-relaxed">
        Upgrade to Pro to create unlimited projects and unlock more credits.
      </p>
      <div className="flex gap-2">
        <button className="btn-precision btn-primary text-[13px] px-4 py-2">Upgrade to Pro</button>
        <button className="btn-precision btn-ghost text-[13px] px-4 py-2" onClick={onClose}>Maybe later</button>
      </div>
      <Separator />
      {/* Disabled form preview */}
      <div className="flex flex-col gap-4 opacity-40 pointer-events-none select-none">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[hsl(var(--text-1))]" htmlFor="new-project-name">Name</label>
          <Input disabled placeholder="Project name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[hsl(var(--text-1))]" htmlFor="new-project-url">Base URL</label>
          <Input disabled placeholder="https://" />
        </div>
        <div className="flex items-center gap-2.5">
          {PROJECT_COLORS.map(c => (
            <div key={c.value} className="w-[18px] h-[18px] rounded-full" style={{ background: c.value }} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CreationStateProps {
  name: string;
  baseUrl: string;
  color: string;
  loading: boolean;
  errors: { name?: string; url?: string };
  onNameChange: (v: string) => void;
  onBaseUrlChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onNameBlur: () => void;
  onUrlBlur: () => void;
  onSubmit: () => void;
}

function CreationState({
  name, baseUrl, color, loading, errors,
  onNameChange, onBaseUrlChange, onColorChange,
  onNameBlur, onUrlBlur, onSubmit,
}: CreationStateProps) {
  return (
    <div className="p-7 flex flex-col gap-5">
      <DialogTitle
        className="text-[18px] font-semibold text-[hsl(var(--text-1))]"
        style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.2px" }}
      >
        New Project
      </DialogTitle>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-[hsl(var(--text-1))]" htmlFor="new-project-name">Name</label>
        <Input
          id="new-project-name"
          autoFocus
          value={name}
          onChange={e => onNameChange(e.target.value)}
          onBlur={onNameBlur}
          placeholder="Project name"
          disabled={loading}
        />
        {errors.name && (
          <span className="text-[11px]" style={{ color: "var(--fail-text)" }}>{errors.name}</span>
        )}
      </div>

      {/* Base URL */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-[hsl(var(--text-1))]" htmlFor="new-project-url">Base URL</label>
        <Input
          id="new-project-url"
          type="url"
          value={baseUrl}
          onChange={e => onBaseUrlChange(e.target.value)}
          onBlur={onUrlBlur}
          placeholder="https://"
          className="font-mono text-[12px]"
          disabled={loading}
        />
        {errors.url ? (
          <span className="text-[11px]" style={{ color: "var(--fail-text)" }}>{errors.url}</span>
        ) : (
          <span className="text-[11px] text-[hsl(var(--text-3))]">
            The root URL your tests will run against.
          </span>
        )}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[12px] font-medium text-[hsl(var(--text-1))]">Color</label>
        <div className="flex items-center gap-2.5">
          {PROJECT_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => onColorChange(c.value)}
              disabled={loading}
              className={cn(
                "w-[18px] h-[18px] rounded-full transition-transform",
                !loading && "hover:scale-110"
              )}
              style={{
                background: c.value,
                outline: color === c.value ? `2px solid ${c.value}` : "2px solid transparent",
                outlineOffset: 2,
              }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Footer */}
      <div className="flex justify-end">
        <button
          className="btn-precision btn-primary text-[13px] px-4 py-2 flex items-center gap-2"
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Creating...
            </>
          ) : (
            "Create →"
          )}
        </button>
      </div>
    </div>
  );
}
